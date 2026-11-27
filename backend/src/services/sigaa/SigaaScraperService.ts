import * as cheerio from "cheerio";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Agent, fetch as undiciFetch } from "undici";
import type { ISigaaScraperService } from "./ISigaaScraperService.js";
import type { ScrapedSigaaActivity } from "@/types/sigaa.js";
import type { ActivityType } from "@/types/activity.js";
import { env } from "@/config/env.js";

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
  "../../../assets/certs/sigaa-ca-bundle.pem",
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

// Fetch used for every SIGAA request. The default attaches the agent that trusts
// the bundled intermediate; tests swap it to simulate SIGAA without network.
type SigaaFetch = typeof undiciFetch;

const sigaaFetch: SigaaFetch = (input, init) =>
  undiciFetch(input, { ...init, dispatcher: getSigaaAgent() });

// Values of the buscaTipoAcao select in the SIGAA search form. Searching all
// types at once ("0") now exceeds SIGAA's result limit, so each type is
// searched on its own.
const SIGAA_ACTION_TYPES = [
  { value: "3", label: "Curso" },
  { value: "4", label: "Evento" },
  { value: "5", label: "Prestação de serviços" },
  { value: "6", label: "Produto" },
  { value: "1", label: "Programa" },
  { value: "2", label: "Projeto" },
] as const;

const EXCESSIVE_RESULTS_TEXT = "resultados excessivos";
const NO_RESULTS_TEXT = "Nenhuma ação de extensão localizada";

const HTML_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

export class SigaaScraperService implements ISigaaScraperService {
  private _searchUrl: string;
  private _timeoutMs: number;
  private _fetch: SigaaFetch;

  constructor(
    searchUrl: string = env.SIGAA_BASE_URL,
    timeoutMs: number = 30_000,
    fetchFn: SigaaFetch = sigaaFetch,
  ) {
    this._searchUrl = searchUrl;
    this._timeoutMs = timeoutMs;
    this._fetch = fetchFn;
  }

  public async scrapeCurrentYearActivities(): Promise<ScrapedSigaaActivity[]> {
    const currentYear = new Date().getFullYear();
    const activitiesById = new Map<string, ScrapedSigaaActivity>();

    // Sequential on purpose, to keep the load on SIGAA down. Any failure aborts
    // the whole scrape: a partial list would make the sync deactivate every
    // action of the types that did not come back.
    for (const actionType of SIGAA_ACTION_TYPES) {
      let activities: ScrapedSigaaActivity[];
      try {
        activities = await this.searchByActionType(
          currentYear,
          actionType.value,
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `SIGAA search for action type "${actionType.label}" failed: ${reason}`,
          { cause: error },
        );
      }

      for (const activity of activities) {
        activitiesById.set(activity.sigaaId, activity);
      }
    }

    return [...activitiesById.values()];
  }

  private async searchByActionType(
    year: number,
    actionType: string,
  ): Promise<ScrapedSigaaActivity[]> {
    // 1. Initial GET to obtain session/cookies and ViewState
    const initialResponse = await this._fetch(this._searchUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: HTML_ACCEPT,
      },
      signal: AbortSignal.timeout(this._timeoutMs),
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

    // 2. POST with validated JSF parameters
    const formParams = new URLSearchParams();
    formParams.append("formBuscaAtividade", "formBuscaAtividade");
    formParams.append("formBuscaAtividade:selectBuscaAno", "on");
    formParams.append("formBuscaAtividade:buscaAno", String(year));
    formParams.append("formBuscaAtividade:selectBuscaTipoAtividade", "on");
    formParams.append("formBuscaAtividade:buscaTipoAcao", actionType);
    formParams.append("formBuscaAtividade:buscaUnidade", "0");
    formParams.append("formBuscaAtividade:btBuscar", "Buscar");
    formParams.append("javax.faces.ViewState", viewState);

    const postResponse = await this._fetch(this._searchUrl, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies,
        Referer: this._searchUrl,
        Accept: HTML_ACCEPT,
      },
      body: formParams.toString(),
      signal: AbortSignal.timeout(this._timeoutMs),
    });

    if (!postResponse.ok) {
      throw new Error(
        `SIGAA POST search request failed with status: ${postResponse.status} ${postResponse.statusText}`,
      );
    }

    const resultHtml = await postResponse.text();
    return this.parseActivitiesHtml(resultHtml);
  }

  // SIGAA answers every search with status 200, so the page itself has to be
  // checked: a refused or unexpected page must not pass as "no activities".
  public parseActivitiesHtml(html: string): ScrapedSigaaActivity[] {
    const $ = cheerio.load(html);
    const pageText = $("body").text().replace(/\s+/g, " ");

    // Checked first: a refused search (such as "excessive results") also shows
    // the no-results notice. SIGAA lists its validation errors in ul.erros, so
    // any of them counts as a refusal, not only the excessive-results one.
    const sigaaErrors = $("ul.erros").text().replace(/\s+/g, " ").trim();
    if (sigaaErrors) {
      throw new Error(`SIGAA refused the search: ${sigaaErrors}`);
    }
    if (pageText.toLowerCase().includes(EXCESSIVE_RESULTS_TEXT)) {
      throw new Error(`SIGAA refused the search: ${EXCESSIVE_RESULTS_TEXT}`);
    }

    const table = $("table.listagem");
    if (table.length === 0) {
      if (pageText.includes(NO_RESULTS_TEXT)) return [];
      throw new Error(
        "SIGAA page has neither the results table nor the no-results notice.",
      );
    }

    // The caption reads "Ações de extensão localizadas (551)".
    const totalMatch = table
      .find("caption")
      .text()
      .match(/\((\d+)\)/);
    if (!totalMatch) {
      throw new Error("SIGAA results table has no total in its caption.");
    }
    const expectedTotal = Number(totalMatch[1]);

    const activities: ScrapedSigaaActivity[] = [];

    const rows = table.find("tr.linhaPar, tr.linhaImpar");

    rows.each((_, element) => {
      const tds = $(element).find("td");
      if (tds.length < 3) return;

      // Remove embedded <script> tags from cells
      $(tds[0]).find("script").remove();

      const titleAnchor = $(tds[0]).find("a");
      const title = (titleAnchor.text() || $(tds[0]).text())
        .replace(/\s+/g, " ")
        .trim();
      if (!title) return;

      const onclickAttr = titleAnchor.attr("onclick") || "";
      const idMatch = onclickAttr.match(
        /'idAtividadeExtensaoSelecionada'\s*:\s*'(\d+)'/,
      );

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

    if (activities.length !== expectedTotal) {
      throw new Error(
        `SIGAA results table has ${activities.length} activities, but its caption reports ${expectedTotal}.`,
      );
    }

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
