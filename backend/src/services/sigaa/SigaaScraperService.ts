import * as cheerio from "cheerio";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Agent, fetch as undiciFetch } from "undici";
import type { ISigaaScraperService } from "./ISigaaScraperService.js";
import type { ScrapedSigaaActivity } from "@/types/sigaa.js";
import type { ActivityType } from "@/types/activity.js";

export const SIGAA_PUBLIC_SEARCH_URL =
  process.env.SIGAA_BASE_URL ??
  "https://sigaa.sig.ufal.br/sigaa/public/extensao/consulta_extensao.jsf";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function loadCaAgent(): Agent {
  const caPath = path.resolve(process.cwd(), "src/config/certs/sigaa-ca-bundle.pem");
  const caCert = fs.readFileSync(caPath, "utf8");
  return new Agent({ connect: { ca: caCert, rejectUnauthorized: true } });
}

let _sigaaAgent: Agent | null = null;

function getSigaaAgent(): Agent {
  if (!_sigaaAgent) {
    _sigaaAgent = loadCaAgent();
  }
  return _sigaaAgent;
}

export class SigaaScraperService implements ISigaaScraperService {
  private _searchUrl: string;
  private _timeoutMs: number;

  constructor(searchUrl: string = SIGAA_PUBLIC_SEARCH_URL, timeoutMs: number = 30_000) {
    this._searchUrl = searchUrl;
    this._timeoutMs = timeoutMs;
  }

  public async scrapeCurrentYearActivities(): Promise<ScrapedSigaaActivity[]> {
    const currentYear = new Date().getFullYear();

    // 1. Initial GET to obtain session/cookies and ViewState
    const initialResponse = await undiciFetch(this._searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(this._timeoutMs),
      dispatcher: getSigaaAgent(),
    });

    if (!initialResponse.ok) {
      throw new Error(
        `SIGAA GET request failed with status: ${initialResponse.status} ${initialResponse.statusText}`
      );
    }

    const setCookieHeaders = initialResponse.headers.getSetCookie
      ? initialResponse.headers.getSetCookie()
      : [initialResponse.headers.get("set-cookie") || ""];

    const cookies = setCookieHeaders
      .filter(Boolean)
      .map((cookie) => cookie.split(";")[0])
      .join("; ");

    const initialHtml = await initialResponse.text();
    const $initial = cheerio.load(initialHtml);

    const viewState = $initial('input[name="javax.faces.ViewState"]').val();
    if (!viewState || typeof viewState !== "string") {
      throw new Error("Unable to extract javax.faces.ViewState from SIGAA page.");
    }

    // 2. POST with validated JSF parameters
    const formParams = new URLSearchParams();
    formParams.append("formBuscaAtividade", "formBuscaAtividade");
    formParams.append("formBuscaAtividade:selectBuscaAno", "on");
    formParams.append("formBuscaAtividade:buscaAno", String(currentYear));
    formParams.append("formBuscaAtividade:buscaTipoAcao", "0");
    formParams.append("formBuscaAtividade:buscaUnidade", "0");
    formParams.append("formBuscaAtividade:btBuscar", "Buscar");
    formParams.append("javax.faces.ViewState", viewState);

    const postResponse = await undiciFetch(this._searchUrl, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
        Referer: this._searchUrl,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      body: formParams.toString(),
      signal: AbortSignal.timeout(this._timeoutMs),
      dispatcher: getSigaaAgent(),
    });

    if (!postResponse.ok) {
      throw new Error(
        `SIGAA POST search request failed with status: ${postResponse.status} ${postResponse.statusText}`
      );
    }

    const resultHtml = await postResponse.text();
    return this.parseActivitiesHtml(resultHtml);
  }

  public parseActivitiesHtml(html: string): ScrapedSigaaActivity[] {
    const $ = cheerio.load(html);
    const activities: ScrapedSigaaActivity[] = [];

    const rows = $("tr.linhaPar, tr.linhaImpar");

    rows.each((_, element) => {
      const tds = $(element).find("td");
      if (tds.length < 3) return;

      // Remove embedded <script> tags from cells
      $(tds[0]).find("script").remove();

      const titleAnchor = $(tds[0]).find("a");
      const title = (titleAnchor.text() || $(tds[0]).text()).replace(/\s+/g, " ").trim();
      if (!title) return;

      const onclickAttr = titleAnchor.attr("onclick") || "";
      const idMatch = onclickAttr.match(/'idAtividadeExtensaoSelecionada'\s*:\s*'(\d+)'/);

      const rawType = $(tds[1]).text().replace(/\s+/g, " ").trim();
      const department = $(tds[2]).text().replace(/\s+/g, " ").trim() || null;

      let sigaaId: string;
      if (idMatch && idMatch[1]) {
        sigaaId = idMatch[1];
      } else {
        sigaaId = crypto
          .createHash("sha256")
          .update(`${title}-${rawType}-${department ?? ""}`)
          .digest("hex")
          .substring(0, 16);
      }

      const normalizedType = this.normalizeActivityType(rawType);

      activities.push({
        sigaaId,
        title,
        type: rawType,
        normalizedType,
        department,
      });
    });

    return activities;
  }

  private normalizeActivityType(rawType: string): ActivityType {
    const upper = rawType.toUpperCase();
    if (upper.includes("CURSO")) return "COURSE";
    if (upper.includes("EVENTO")) return "EVENT";
    if (
      upper.includes("PROJETO") ||
      upper.includes("PROGRAMA") ||
      upper.includes("PRODUTO") ||
      upper.includes("PRESTAÇÃO DE SERVIÇO") ||
      upper.includes("PRESTACAO DE SERVICO") ||
      upper.includes("EXTENSÃO") ||
      upper.includes("EXTENSAO")
    ) {
      return "EXTENSION";
    }
    return "OTHER";
  }
}

export default SigaaScraperService;
