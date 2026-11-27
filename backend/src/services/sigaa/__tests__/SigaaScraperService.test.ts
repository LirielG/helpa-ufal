import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";
import SigaaScraperService from "../SigaaScraperService.js";

type Row = { id?: string; title: string; type: string; department: string };

function resultRow({ id, title, type, department }: Row, index: number) {
  const rowClass = index % 2 === 0 ? "linhaPar" : "linhaImpar";
  const onclick = id
    ? ` onclick="if(typeof jsfcljs == 'function'){jsfcljs(document.getElementById('formBuscaAtividade'),{'formBuscaAtividade:j_id_jsp_1714545237_17:0:j_id_jsp_1714545237_20':'formBuscaAtividade:j_id_jsp_1714545237_17:0:j_id_jsp_1714545237_20','idAtividadeExtensaoSelecionada':'${id}'},'');}return false;"`
    : "";
  return `
    <tr class="${rowClass}">
      <td><a href="#"${onclick}>${title}</a></td>
      <td>${type}</td>
      <td>${department}</td>
    </tr>`;
}

// Mirrors the markup SIGAA serves, including the HTML entities in the caption.
function resultsPage(rows: Row[], captionTotal: number | null = rows.length) {
  const caption =
    captionTotal === null
      ? ""
      : `<caption>A&#231;&#245;es de extens&#227;o localizadas (${captionTotal})</caption>`;
  return `
    <!DOCTYPE html>
    <html>
      <body>
        <table class="listagem" width="100%">
          ${caption}
          <thead>
            <tr><th>Ano/T&#237;tulo</th><th>Tipo</th><th>Unidade</th></tr>
          </thead>
          <tbody>${rows.map(resultRow).join("")}</tbody>
        </table>
      </body>
    </html>`;
}

const NO_RESULTS_BLOCK =
  "<center><h3><i>Nenhuma a&#231;&#227;o de extens&#227;o localizada</i></h3></center>";

const noResultsPage = `<html><body>${NO_RESULTS_BLOCK}</body></html>`;

// SIGAA's "too many results" page also carries the "no results" notice.
const excessiveResultsPage = `
  <html><body>
    <ul class="erros">
      <li>A consulta retornou resultados excessivos. Por favor, restrinja mais a busca.</li>
    </ul>
    ${NO_RESULTS_BLOCK}
  </body></html>`;

// The action types SIGAA offers in the search form, in the order it lists them.
const SIGAA_FORM_TYPES = [
  ["3", "CURSO"],
  ["4", "EVENTO"],
  ["5", "PRESTA&Ccedil;&Atilde;O DE SERVI&Ccedil;OS"],
  ["6", "PRODUTO"],
  ["1", "PROGRAMA"],
  ["2", "PROJETO"],
];

function formPage(actionTypes: string[][] = SIGAA_FORM_TYPES) {
  const options = actionTypes
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  return `
  <html><body>
    <form id="formBuscaAtividade">
      <select name="formBuscaAtividade:buscaTipoAcao">
        <option value="0" selected="selected">-- SELECIONE UM TIPO DE A&Ccedil;&Atilde;O --</option>
        ${options}
      </select>
      <input type="hidden" name="javax.faces.ViewState" value="j_id42" />
    </form>
  </body></html>`;
}

function fakeResponse(html: string) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {
      getSetCookie: () => ["JSESSIONID=abc; Path=/sigaa"],
      get: () => null,
    },
    text: async () => html,
  };
}

// Serves the form on every GET and the page for the requested action type on every POST.
function fakeSigaa(
  pagesByActionType: Record<string, string>,
  form: string = formPage(),
) {
  return vi.fn(
    async (_url: unknown, init?: { method?: string; body?: unknown }) => {
      if (init?.method === "GET") return fakeResponse(form);
      const params = new URLSearchParams(String(init?.body));
      const actionType = params.get("formBuscaAtividade:buscaTipoAcao") ?? "";
      return fakeResponse(pagesByActionType[actionType] ?? noResultsPage);
    },
  );
}

function scraperWith(fetchFn: ReturnType<typeof fakeSigaa>) {
  return new SigaaScraperService(
    "https://sigaa.example/consulta_extensao.jsf",
    1_000,
    fetchFn as unknown as ConstructorParameters<typeof SigaaScraperService>[2],
  );
}

describe("SigaaScraperService", () => {
  const scraper = new SigaaScraperService();

  describe("parseActivitiesHtml", () => {
    it("parses rows, extracts ids from onclick and normalizes types", () => {
      const html = resultsPage([
        {
          id: "12345",
          title: "2026 - CURSO DE ROBÓTICA PARA ESCOLAS PÚBLICAS",
          type: "CURSO",
          department: "CAMPUS ARAPIRACA",
        },
        {
          id: "67890",
          title: "2026 - FESTIVAL DE TEATRO UNIVERSITÁRIO",
          type: "EVENTO",
          department: "ICHCA",
        },
        {
          id: "99999",
          title: "2026 - APLICATIVO HELPA EXTENSÃO",
          type: "PRODUTO",
          department: "INSTITUTO DE COMPUTAÇÃO",
        },
      ]);

      const results = scraper.parseActivitiesHtml(html);

      expect(results).toEqual([
        {
          sigaaId: "12345",
          title: "2026 - CURSO DE ROBÓTICA PARA ESCOLAS PÚBLICAS",
          type: "CURSO",
          normalizedType: "COURSE",
          department: "CAMPUS ARAPIRACA",
        },
        {
          sigaaId: "67890",
          title: "2026 - FESTIVAL DE TEATRO UNIVERSITÁRIO",
          type: "EVENTO",
          normalizedType: "EVENT",
          department: "ICHCA",
        },
        {
          sigaaId: "99999",
          title: "2026 - APLICATIVO HELPA EXTENSÃO",
          type: "PRODUTO",
          normalizedType: "EXTENSION",
          department: "INSTITUTO DE COMPUTAÇÃO",
        },
      ]);
    });

    it("generates a fallback hash when onclick has no idAtividadeExtensaoSelecionada", () => {
      const html = resultsPage([
        {
          title: "2026 - AÇÃO SEM ONCLICK COM ID",
          type: "PROJETO",
          department: "FEAC",
        },
      ]);

      const results = scraper.parseActivitiesHtml(html);

      expect(results).toHaveLength(1);
      expect(results[0].sigaaId).toMatch(/^[0-9a-f]{16}$/);
      expect(results[0].normalizedType).toBe("EXTENSION");
    });

    it("throws when SIGAA reports excessive results, even though the page also says nothing was found", () => {
      expect(() => scraper.parseActivitiesHtml(excessiveResultsPage)).toThrow(
        /resultados excessivos/,
      );
    });

    it("throws on any SIGAA error list, so a refused search never passes as no results", () => {
      const refusedPage = `
        <html><body>
          <ul class="erros"><li>Ano: Valor inválido.</li></ul>
          ${NO_RESULTS_BLOCK}
        </body></html>`;

      expect(() => scraper.parseActivitiesHtml(refusedPage)).toThrow(
        /Ano: Valor inválido/,
      );
    });

    it("throws when the number of rows differs from the total in the table caption", () => {
      const html = resultsPage(
        [
          { id: "1", title: "2026 - A", type: "CURSO", department: "X" },
          { id: "2", title: "2026 - B", type: "CURSO", department: "X" },
        ],
        3,
      );

      expect(() => scraper.parseActivitiesHtml(html)).toThrow(/2.*3/);
    });

    it("throws when the results table has no caption with the total", () => {
      const html = resultsPage(
        [{ id: "1", title: "2026 - A", type: "CURSO", department: "X" }],
        null,
      );

      expect(() => scraper.parseActivitiesHtml(html)).toThrow();
    });

    it("returns no activities when SIGAA says no action was found", () => {
      expect(scraper.parseActivitiesHtml(noResultsPage)).toEqual([]);
    });

    it("throws when the page has neither the results table nor the no-results notice", () => {
      const unexpectedPage = "<html><body><p>Sessão expirada</p></body></html>";

      expect(() => scraper.parseActivitiesHtml(unexpectedPage)).toThrow();
    });
  });

  describe("scrapeCurrentYearActivities", () => {
    it("runs one search per action type, in sequence, each after its own GET", async () => {
      const fetchFn = fakeSigaa({});

      await scraperWith(fetchFn).scrapeCurrentYearActivities();

      const calls = fetchFn.mock.calls.map(([, init]) => init);
      expect(calls.map((init) => init?.method)).toEqual(
        Array.from({ length: 6 }, () => ["GET", "POST"]).flat(),
      );

      const searches = calls
        .filter((init) => init?.method === "POST")
        .map((init) => new URLSearchParams(String(init?.body)));
      expect(
        searches.map((params) =>
          params.get("formBuscaAtividade:buscaTipoAcao"),
        ),
      ).toEqual(["3", "4", "5", "6", "1", "2"]);
      for (const params of searches) {
        expect(params.get("formBuscaAtividade:selectBuscaTipoAtividade")).toBe(
          "on",
        );
        expect(params.get("formBuscaAtividade:buscaAno")).toBe(
          String(new Date().getFullYear()),
        );
        expect(params.get("javax.faces.ViewState")).toBe("j_id42");
      }
    });

    it("searches the action types the SIGAA form offers, not a fixed list", async () => {
      const fetchFn = fakeSigaa(
        {},
        formPage([
          ["4", "EVENTO"],
          ["7", "NOVO TIPO"],
        ]),
      );

      await scraperWith(fetchFn).scrapeCurrentYearActivities();

      const searchedTypes = fetchFn.mock.calls
        .map(([, init]) => init)
        .filter((init) => init?.method === "POST")
        .map((init) =>
          new URLSearchParams(String(init?.body)).get(
            "formBuscaAtividade:buscaTipoAcao",
          ),
        );
      expect(searchedTypes).toEqual(["4", "7"]);
    });

    it("rejects when the SIGAA form lists no action type", async () => {
      const fetchFn = fakeSigaa({}, formPage([]));

      await expect(
        scraperWith(fetchFn).scrapeCurrentYearActivities(),
      ).rejects.toThrow(/action type/);
      expect(
        fetchFn.mock.calls.filter(([, init]) => init?.method === "POST"),
      ).toHaveLength(0);
    });

    it("merges the results of every search without repeating a sigaaId", async () => {
      const fetchFn = fakeSigaa({
        "3": resultsPage([
          { id: "10", title: "2026 - CURSO A", type: "CURSO", department: "X" },
        ]),
        "2": resultsPage([
          {
            id: "20",
            title: "2026 - PROJETO B",
            type: "PROJETO",
            department: "Y",
          },
          { id: "10", title: "2026 - CURSO A", type: "CURSO", department: "X" },
        ]),
      });

      const results = await scraperWith(fetchFn).scrapeCurrentYearActivities();

      expect(results.map((activity) => activity.sigaaId).sort()).toEqual([
        "10",
        "20",
      ]);
    });

    it("rejects without a partial list when any search fails, naming the action type", async () => {
      const fetchFn = fakeSigaa({
        "3": resultsPage([
          { id: "10", title: "2026 - CURSO A", type: "CURSO", department: "X" },
        ]),
        "6": excessiveResultsPage,
      });

      await expect(
        scraperWith(fetchFn).scrapeCurrentYearActivities(),
      ).rejects.toThrow(/PRODUTO/);
    });
  });

  it("loads the SIGAA CA bundle from assets/certs/sigaa-ca-bundle.pem when initializing the TLS agent", async () => {
    const expectedCertPath = path.resolve(
      import.meta.dirname,
      "../../../../assets/certs/sigaa-ca-bundle.pem",
    );
    const readFileSyncSpy = vi.spyOn(fs, "readFileSync");
    const offlineScraper = new SigaaScraperService("http://127.0.0.1:1", 50);

    await expect(
      offlineScraper.scrapeCurrentYearActivities(),
    ).rejects.toThrow();

    expect(readFileSyncSpy).toHaveBeenCalledWith(expectedCertPath, "utf8");
    readFileSyncSpy.mockRestore();
  });
});
