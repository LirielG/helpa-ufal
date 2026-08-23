import { describe, it, expect } from "vitest";
import SigaaScraperService from "../SigaaScraperService.js";

describe("SigaaScraperService", () => {
  const scraper = new SigaaScraperService();

  const mockSigaaHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <table class="listagem">
          <thead>
            <tr>
              <th>Título da Ação</th>
              <th>Tipo da Ação</th>
              <th>Unidade Proponente</th>
            </tr>
          </thead>
          <tbody>
            <tr class="linhaPar">
              <td>
                <a href="#" onclick="if(typeof jsfcljs == 'function'){jsfcljs(document.getElementById('formBuscaAtividade'),{'formBuscaAtividade:j_id_jsp_1714545237_17:0:j_id_jsp_1714545237_20':'formBuscaAtividade:j_id_jsp_1714545237_17:0:j_id_jsp_1714545237_20','idAtividadeExtensaoSelecionada':'12345'},'');}return false;">
                  2026 - CURSO DE ROBÓTICA PARA ESCOLAS PÚBLICAS
                </a>
              </td>
              <td>CURSO</td>
              <td>CAMPUS ARAPIRACA</td>
            </tr>
            <tr class="linhaImpar">
              <td>
                <a href="#" onclick="if(typeof jsfcljs == 'function'){jsfcljs(document.getElementById('formBuscaAtividade'),{'idAtividadeExtensaoSelecionada':'67890'},'');}return false;">
                  2026 - FESTIVAL DE TEATRO UNIVERSITÁRIO
                </a>
              </td>
              <td>EVENTO</td>
              <td>ICHCA</td>
            </tr>
            <tr class="linhaPar">
              <td>
                <a href="#" onclick="if(typeof jsfcljs == 'function'){jsfcljs(document.getElementById('formBuscaAtividade'),{'idAtividadeExtensaoSelecionada':'99999'},'');}return false;">
                  2026 - APLICATIVO HELPA EXTENSÃO
                </a>
              </td>
              <td>PRODUTO</td>
              <td>INSTITUTO DE COMPUTAÇÃO</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `;

  it("should correctly parse SIGAA HTML rows, extract ids from onclick, and normalize types", () => {
    const results = scraper.parseActivitiesHtml(mockSigaaHtml);

    expect(results).toHaveLength(3);

    expect(results[0]).toEqual({
      sigaaId: "12345",
      title: "2026 - CURSO DE ROBÓTICA PARA ESCOLAS PÚBLICAS",
      type: "CURSO",
      normalizedType: "COURSE",
      department: "CAMPUS ARAPIRACA",
    });

    expect(results[1]).toEqual({
      sigaaId: "67890",
      title: "2026 - FESTIVAL DE TEATRO UNIVERSITÁRIO",
      type: "EVENTO",
      normalizedType: "EVENT",
      department: "ICHCA",
    });

    expect(results[2]).toEqual({
      sigaaId: "99999",
      title: "2026 - APLICATIVO HELPA EXTENSÃO",
      type: "PRODUTO",
      normalizedType: "EXTENSION",
      department: "INSTITUTO DE COMPUTAÇÃO",
    });
  });

  it("should generate a fallback hash if onclick does not contain idAtividadeExtensaoSelecionada", () => {
    const htmlWithoutId = `
      <table class="listagem">
        <tr class="linhaPar">
          <td>
            <a href="#">2026 - AÇÃO SEM ONCLICK COM ID</a>
          </td>
          <td>PROJETO</td>
          <td>FEAC</td>
        </tr>
      </table>
    `;

    const results = scraper.parseActivitiesHtml(htmlWithoutId);
    expect(results).toHaveLength(1);
    expect(results[0].sigaaId).toBeDefined();
    expect(results[0].sigaaId.length).toBeGreaterThan(0);
    expect(results[0].normalizedType).toBe("EXTENSION");
  });
});
