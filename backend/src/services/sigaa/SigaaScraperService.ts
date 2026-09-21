import * as cheerio from "cheerio";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Agent, fetch as undiciFetch } from "undici";
import type { ISigaaScraperService } from "./ISigaaScraperService.js";
import type { ScrapedSigaaActivity } from "@/types/sigaa.js";
import type { ActivityType } from "@/types/activity.js";
import { env } from "@/config/env.js";

// SIGAA refuses requests that do not look like a browser, so the scraper sends
// a browser's User-Agent.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// SIGAA serves a broken TLS chain: the leaf (*.sig.ufal.br) is issued by
// "RNP ICPEdu GR46 OV TLS CA 2025", but that intermediate is never sent. The
// server ships an unrelated (and already expired) *.ufal.br chain instead, so
// verification fails with UNABLE_TO_VERIFY_LEAF_SIGNATURE. Supplying the
// missing intermediate lets us keep rejectUnauthorized enabled.
//
// The bundled intermediate expires on 2030-11-19. Once UFAL fixes the chain it
// serves, this whole CA agent can be dropped in favour of the default fetch.
const CA_BUNDLE_PATH = path.resolve(
  import.meta.dirname,
  "../../config/certs/sigaa-ca-bundle.pem",
);

function loadCaAgent(): Agent {
  const caCert = fs.readFileSync(CA_BUNDLE_PATH, "utf8");
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

  constructor(
    searchUrl: string = env.SIGAA_BASE_URL,
    timeoutMs: number = 30_000,
  ) {
    this._searchUrl = searchUrl;
    this._timeoutMs = timeoutMs;
  }

  public async scrapeCurrentYearActivities(): Promise<ScrapedSigaaActivity[]> {
    const currentYear = new Date().getFullYear();

    // SIGAA is a JSF application, and that dictates the two-step shape below:
    // the search form only accepts a POST that echoes back the ViewState token
    // it handed out, together with the session cookies from the same exchange.

    // 1. GET for the session cookies and the ViewState token.
    const initialResponse = await undiciFetch(this._searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(this._timeoutMs),
      dispatcher: getSigaaAgent(),
    });

    if (!initialResponse.ok) {
      throw new Error(
        `SIGAA GET request failed with status: ${initialResponse.status} ${initialResponse.statusText}`,
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
      throw new Error(
        "Unable to extract javax.faces.ViewState from SIGAA page.",
      );
    }

    // 2. POST the search form. The field names are SIGAA's own; "0" means "all"
    // for both the type and the unit, and only the current year is fetched.
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
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      body: formParams.toString(),
      signal: AbortSignal.timeout(this._timeoutMs),
      dispatcher: getSigaaAgent(),
    });

    if (!postResponse.ok) {
      throw new Error(
        `SIGAA POST search request failed with status: ${postResponse.status} ${postResponse.statusText}`,
      );
    }

    const resultHtml = await postResponse.text();
    return this.parseActivitiesHtml(resultHtml);
  }

  /**
   * Public and pure so the parser can be tested against a saved sample of the
   * SIGAA page, with no network. When the page changes, update the sample
   * alongside the selectors — a test passing against an old sample says
   * nothing about the page as it is served today.
   *
   * Every selector below is SIGAA's markup, not ours. See docs/SIGAA.md.
   */
  public parseActivitiesHtml(html: string): ScrapedSigaaActivity[] {
    const $ = cheerio.load(html);
    const activities: ScrapedSigaaActivity[] = [];

    // SIGAA zebra-stripes the results table with these two classes, and they
    // are the only thing that distinguishes a result row from the header and
    // the layout rows around it.
    const rows = $("tr.linhaPar, tr.linhaImpar");

    rows.each((_, element) => {
      const tds = $(element).find("td");
      if (tds.length < 3) return;

      // The title cell carries an inline <script> whose source would otherwise
      // be picked up by .text() and end up inside the title.
      $(tds[0]).find("script").remove();

      // Columns: 0 = title (a link), 1 = type, 2 = department.
      const titleAnchor = $(tds[0]).find("a");
      const title = (titleAnchor.text() || $(tds[0]).text())
        .replace(/\s+/g, " ")
        .trim();
      if (!title) return;

      // The real id is not in the markup as an attribute: JSF hides it in the
      // onclick handler that submits the detail form.
      const onclickAttr = titleAnchor.attr("onclick") || "";
      const idMatch = onclickAttr.match(
        /'idAtividadeExtensaoSelecionada'\s*:\s*'(\d+)'/,
      );

      const rawType = $(tds[1]).text().replace(/\s+/g, " ").trim();
      const department = $(tds[2]).text().replace(/\s+/g, " ").trim() || null;

      // Falling back to a content hash keeps the upsert stable across syncs
      // when the id cannot be read. The trade-off: the id then depends on the
      // content, so a title edited in SIGAA becomes a NEW cache row and the old
      // one is marked inactive — which reads as a duplicate while both linger.
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
