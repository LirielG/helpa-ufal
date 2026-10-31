import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import {
  API,
  delay,
  http,
  HttpResponse,
  makeReport,
  render,
  screen,
  server,
  signIn,
  waitFor,
  within,
} from "@/test";
import { REPORT_REASONS } from "@/features/report/constants/reportReasons";
import type { Report } from "@/services/contracts/report";
import { ModerationPage } from "@/pages/ModerationPage";

function renderModerationPage() {
  return render(
    <Routes>
      <Route path="/moderacao" element={<ModerationPage />} />
      <Route path="/activity/:id" element={<h1>Detalhe da ação</h1>} />
    </Routes>,
    { route: "/moderacao" },
  );
}

function serveReports(
  items: Report[],
  overrides: { total?: number; page?: number; totalPages?: number } = {},
) {
  const queries: Array<{ resolved: string | null; page: string | null }> = [];

  server.use(
    http.get(`${API}/reports`, ({ request }) => {
      const searchParams = new URL(request.url).searchParams;
      queries.push({
        resolved: searchParams.get("resolved"),
        page: searchParams.get("page"),
      });

      const total = overrides.total ?? items.length;
      const limit = 20;
      return HttpResponse.json({
        items,
        total,
        page: overrides.page ?? Number(searchParams.get("page") ?? "1"),
        limit,
        totalPages:
          overrides.totalPages ?? Math.max(1, Math.ceil(total / limit)),
      });
    }),
  );

  return queries;
}

describe("ModerationPage", () => {
  describe("open queue (default tab)", () => {
    it("fetches open reports and renders pt-BR category labels, description, action link, reporter and date", async () => {
      signIn({ isManager: true });
      const report = makeReport({
        id: "rep-1",
        category: "MISINFORMATION",
        description: "Endereço informado não existe.",
        createdAt: "2026-06-05T15:00:00.000Z",
        activity: {
          id: "act-42",
          title: "Mutirão de Limpeza na Praia",
        },
        reporter: {
          fullName: "Carlos Eduardo",
        },
      });
      const queries = serveReports([report]);

      renderModerationPage();

      expect(
        await screen.findByRole("heading", {
          name: "Informação falsa ou enganosa",
        }),
      ).toBeInTheDocument();
      expect(queries).toEqual([{ resolved: "false", page: "1" }]);
      expect(
        screen.getByText("Endereço informado não existe."),
      ).toBeInTheDocument();
      expect(screen.getByText("Carlos Eduardo")).toBeInTheDocument();
      expect(screen.getByText("05/06/2026")).toBeInTheDocument();
      expect(screen.getByText("Aberta")).toBeInTheDocument();

      const actionLink = screen.getByRole("link", {
        name: "Mutirão de Limpeza na Praia",
      });
      expect(actionLink).toHaveAttribute("href", "/activity/act-42");
    });

    it.each(REPORT_REASONS)(
      "translates category $value to '$label'",
      async ({ value, label }) => {
        signIn({ isManager: true });
        serveReports([makeReport({ category: value })]);

        renderModerationPage();

        expect(
          await screen.findByRole("heading", { name: label }),
        ).toBeInTheDocument();
      },
    );

    it("renders 'Sem descrição' when description is null", async () => {
      signIn({ isManager: true });
      serveReports([makeReport({ description: null })]);

      renderModerationPage();

      expect(await screen.findByText("Sem descrição")).toBeInTheDocument();
    });

    it("renders 'Conta removida' without 'null' when reporter is null", async () => {
      signIn({ isManager: true });
      serveReports([makeReport({ reporter: null })]);

      renderModerationPage();

      expect(await screen.findByText("Conta removida")).toBeInTheDocument();
      expect(screen.queryByText("null")).not.toBeInTheDocument();
    });

    it("navigates to /activity/:id when clicking the reported action title", async () => {
      signIn({ isManager: true });
      serveReports([
        makeReport({
          activity: { id: "act-deleted", title: "Ação Antiga" },
        }),
      ]);

      const { user } = renderModerationPage();

      await user.click(
        await screen.findByRole("link", { name: "Ação Antiga" }),
      );

      expect(
        await screen.findByRole("heading", { name: "Detalhe da ação" }),
      ).toBeInTheDocument();
    });

    it("shows the loading state while reports are in flight", async () => {
      signIn({ isManager: true });
      server.use(
        http.get(`${API}/reports`, async () => {
          await delay(80);
          return HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 1,
          });
        }),
      );

      renderModerationPage();

      expect(screen.getByRole("status")).toHaveTextContent(
        "Carregando denúncias…",
      );
      expect(
        await screen.findByText("Nenhuma denúncia em aberto."),
      ).toBeInTheDocument();
    });
  });

  describe("tabs and empty states", () => {
    it("displays distinct empty states for 'Em aberto' and 'Resolvidas'", async () => {
      signIn({ isManager: true });
      serveReports([]);

      const { user } = renderModerationPage();

      expect(
        await screen.findByText("Nenhuma denúncia em aberto."),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Resolvidas" }));

      expect(
        await screen.findByText("Nenhuma denúncia resolvida."),
      ).toBeInTheDocument();
    });

    it("fetches GET /reports?resolved=true on switching to 'Resolvidas' and shows 'Resolvida em <data>' without Resolver button", async () => {
      signIn({ isManager: true });
      const openReport = makeReport({
        id: "open-1",
        category: "SPAM",
        resolvedAt: null,
      });
      const resolvedReport = makeReport({
        id: "res-1",
        category: "DUPLICATE",
        createdAt: "2026-06-01T15:00:00.000Z",
        resolvedAt: "2026-06-10T15:00:00.000Z",
      });

      const requestedResolvedValues: Array<string | null> = [];
      server.use(
        http.get(`${API}/reports`, ({ request }) => {
          const resolvedParam = new URL(request.url).searchParams.get(
            "resolved",
          );
          requestedResolvedValues.push(resolvedParam);

          const items =
            resolvedParam === "true" ? [resolvedReport] : [openReport];
          return HttpResponse.json({
            items,
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          });
        }),
      );

      const { user } = renderModerationPage();

      expect(
        await screen.findByRole("heading", {
          name: "Spam ou divulgação indevida",
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Resolver" }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole("tab", { name: "Resolvidas" }));

      expect(
        await screen.findByRole("heading", { name: "Ação duplicada" }),
      ).toBeInTheDocument();
      expect(screen.getByText("Resolvida em 10/06/2026")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Resolver" }),
      ).not.toBeInTheDocument();
      expect(requestedResolvedValues).toEqual(["false", "true"]);
    });
  });

  describe("pagination", () => {
    it("renders Pagination from totalPages and requests the selected page", async () => {
      signIn({ isManager: true });
      const requestedPages: Array<string | null> = [];

      server.use(
        http.get(`${API}/reports`, ({ request }) => {
          const page = new URL(request.url).searchParams.get("page");
          requestedPages.push(page);

          return HttpResponse.json({
            items: [
              makeReport({
                description: `Item da página ${page}`,
              }),
            ],
            total: 45,
            page: Number(page ?? "1"),
            limit: 20,
            totalPages: 3,
          });
        }),
      );

      const { user } = renderModerationPage();

      expect(await screen.findByText("Item da página 1")).toBeInTheDocument();
      const pagination = screen.getByRole("navigation", { name: "Paginação" });
      expect(
        within(pagination).getByRole("button", { name: "Página 3" }),
      ).toBeInTheDocument();

      await user.click(
        within(pagination).getByRole("button", { name: "Página 2" }),
      );

      expect(await screen.findByText("Item da página 2")).toBeInTheDocument();
      expect(requestedPages).toEqual(["1", "2"]);
    });
  });

  describe("resolving a report", () => {
    it("asks for confirmation, resolves via PUT and removes the report from 'Em aberto' without reloading the list", async () => {
      signIn({ isManager: true });
      const first = makeReport({
        id: "rep-1",
        category: "SPAM",
        description: "Primeira denúncia",
      });
      const second = makeReport({
        id: "rep-2",
        category: "OTHER",
        description: "Segunda denúncia",
      });

      let listCalls = 0;
      const resolvedIds: string[] = [];

      server.use(
        http.get(`${API}/reports`, () => {
          listCalls += 1;
          return HttpResponse.json({
            items: [first, second],
            total: 2,
            page: 1,
            limit: 20,
            totalPages: 1,
          });
        }),
        http.put(`${API}/reports/:reportId/resolution`, ({ params }) => {
          const reportId = String(params.reportId);
          resolvedIds.push(reportId);
          return HttpResponse.json({
            ...first,
            id: reportId,
            resolvedAt: "2026-06-10T12:00:00.000Z",
          });
        }),
      );

      const { user } = renderModerationPage();

      expect(await screen.findByText("Primeira denúncia")).toBeInTheDocument();

      const resolveButtons = screen.getAllByRole("button", {
        name: "Resolver",
      });
      await user.click(resolveButtons[0]);

      const dialog = screen.getByRole("dialog", {
        name: "Confirmar resolução",
      });
      expect(
        within(dialog).getByText(/não poderá ser reaberta/i),
      ).toBeInTheDocument();

      await user.click(within(dialog).getByRole("button", { name: "Sim" }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(resolvedIds).toEqual(["rep-1"]);
      expect(listCalls).toBe(1);
      expect(screen.queryByText("Primeira denúncia")).not.toBeInTheDocument();
      expect(screen.getByText("Segunda denúncia")).toBeInTheDocument();
    });

    it("cancels without calling PUT when 'Não' or Escape is used", async () => {
      signIn({ isManager: true });
      serveReports([makeReport({ id: "rep-1", description: "Continua aqui" })]);

      let putCalls = 0;
      server.use(
        http.put(`${API}/reports/:reportId/resolution`, () => {
          putCalls += 1;
          return HttpResponse.json(
            makeReport({ resolvedAt: "2026-06-10T12:00:00.000Z" }),
          );
        }),
      );

      const { user } = renderModerationPage();

      await user.click(await screen.findByRole("button", { name: "Resolver" }));
      const dialog = screen.getByRole("dialog", {
        name: "Confirmar resolução",
      });

      await user.click(within(dialog).getByRole("button", { name: "Não" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Resolver" }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      await user.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(putCalls).toBe(0);
      expect(screen.getByText("Continua aqui")).toBeInTheDocument();
    });

    it("handles an idempotent 200 (already resolved by another manager) without showing an error", async () => {
      signIn({ isManager: true });
      const report = makeReport({
        id: "rep-already",
        description: "Já resolvida",
      });
      serveReports([report]);

      server.use(
        http.put(`${API}/reports/:reportId/resolution`, () =>
          HttpResponse.json({
            ...report,
            // Earlier resolution timestamp from another manager
            resolvedAt: "2026-05-01T08:30:00.000Z",
          }),
        ),
      );

      const { user } = renderModerationPage();

      await user.click(await screen.findByRole("button", { name: "Resolver" }));
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Sim" }));

      expect(
        await screen.findByText("Nenhuma denúncia em aberto."),
      ).toBeInTheDocument();
      expect(
        await screen.findByText("Denúncia marcada como resolvida."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/não foi possível|permissão|não encontrada/i),
      ).not.toBeInTheDocument();
    });

    it("sends a single PUT request on a fast double click", async () => {
      signIn({ isManager: true });
      const report = makeReport({ id: "rep-dbl" });
      serveReports([report]);

      let calls = 0;
      server.use(
        http.put(`${API}/reports/:reportId/resolution`, async () => {
          calls += 1;
          await delay(50);
          return HttpResponse.json({
            ...report,
            resolvedAt: "2026-06-10T12:00:00.000Z",
          });
        }),
      );

      const { user } = renderModerationPage();

      await user.click(await screen.findByRole("button", { name: "Resolver" }));
      const dialog = screen.getByRole("dialog");
      await user.dblClick(within(dialog).getByRole("button", { name: "Sim" }));

      expect(
        await screen.findByText("Nenhuma denúncia em aberto."),
      ).toBeInTheDocument();
      expect(calls).toBe(1);
    });
  });

  describe("authorization and error states", () => {
    it("shows a pt-BR permission message and no report data when a regular user gets 403", async () => {
      signIn({ isManager: false });
      server.use(
        http.get(`${API}/reports`, () =>
          HttpResponse.json(
            {
              status: 403,
              code: "FORBIDDEN",
              message: "User is not a manager.",
            },
            { status: 403 },
          ),
        ),
      );

      renderModerationPage();

      expect(
        await screen.findByText(
          "Você não tem permissão para acessar a moderação de denúncias.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("list", { name: "Lista de denúncias" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Tentar novamente" }),
      ).not.toBeInTheDocument();
    });

    it.each([0, 500])(
      "displays a pt-BR connection error (%i) with a working 'Tentar novamente' button",
      async (status) => {
        signIn({ isManager: true });
        let attempts = 0;

        server.use(
          http.get(`${API}/reports`, () => {
            attempts += 1;
            if (attempts === 1) {
              return status === 0
                ? HttpResponse.error()
                : new HttpResponse(null, { status });
            }

            return HttpResponse.json({
              items: [
                makeReport({ description: "Carregada na segunda tentativa" }),
              ],
              total: 1,
              page: 1,
              limit: 20,
              totalPages: 1,
            });
          }),
        );

        const { user } = renderModerationPage();

        expect(
          await screen.findByText(/Não foi possível conectar ao servidor/),
        ).toBeInTheDocument();

        await user.click(
          screen.getByRole("button", { name: "Tentar novamente" }),
        );

        expect(
          await screen.findByText("Carregada na segunda tentativa"),
        ).toBeInTheDocument();
      },
    );

    it("keeps the modal open with an error alert when PUT fails due to network error", async () => {
      signIn({ isManager: true });
      serveReports([
        makeReport({ id: "rep-net", description: "Permanece na fila" }),
      ]);
      server.use(
        http.put(`${API}/reports/:reportId/resolution`, () =>
          HttpResponse.error(),
        ),
      );

      const { user } = renderModerationPage();

      await user.click(await screen.findByRole("button", { name: "Resolver" }));
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Sim" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Não foi possível conectar ao servidor. Tente novamente.",
      );
      expect(within(dialog).getByRole("button", { name: "Sim" })).toBeEnabled();
      expect(screen.getByText("Permanece na fila")).toBeInTheDocument();
    });

    it("shows a pt-BR permission error inside the modal and disables 'Sim' when PUT answers 403", async () => {
      signIn({ isManager: true });
      serveReports([makeReport({ id: "rep-403" })]);
      server.use(
        http.put(`${API}/reports/:reportId/resolution`, () =>
          HttpResponse.json(
            {
              status: 403,
              code: "FORBIDDEN",
              message: "User is not a manager.",
            },
            { status: 403 },
          ),
        ),
      );

      const { user } = renderModerationPage();

      await user.click(await screen.findByRole("button", { name: "Resolver" }));
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Sim" }));

      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        "Você não tem permissão para resolver esta denúncia.",
      );
      expect(
        within(dialog).getByRole("button", { name: "Sim" }),
      ).toBeDisabled();
      expect(within(dialog).getByRole("button", { name: "Não" })).toBeEnabled();
    });

    it("drops the missing report and shows a pt-BR notice when PUT answers 404", async () => {
      signIn({ isManager: true });
      serveReports([makeReport({ id: "rep-gone", description: "Sumiu" })]);
      server.use(
        http.put(`${API}/reports/:reportId/resolution`, () =>
          HttpResponse.json(
            { status: 404, code: "NOT_FOUND", message: "Report not found." },
            { status: 404 },
          ),
        ),
      );

      const { user } = renderModerationPage();

      await user.click(await screen.findByRole("button", { name: "Resolver" }));
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Sim" }));

      expect(
        await screen.findByText(
          "Denúncia não encontrada. Ela pode ter sido removida.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(
        screen.getByText("Nenhuma denúncia em aberto."),
      ).toBeInTheDocument();
    });
  });

  describe("keyboard navigation", () => {
    it("switches tabs with ArrowRight/ArrowLeft and navigates cards with ArrowDown/ArrowUp", async () => {
      signIn({ isManager: true });
      const first = makeReport({
        id: "rep-k1",
        category: "SPAM",
        description: "Card 1",
      });
      const second = makeReport({
        id: "rep-k2",
        category: "OTHER",
        description: "Card 2",
      });
      serveReports([first, second]);

      const { user } = renderModerationPage();

      const articles = await screen.findAllByRole("article");
      articles[0].focus();
      expect(articles[0]).toHaveFocus();

      await user.keyboard("{ArrowDown}");
      expect(articles[1]).toHaveFocus();

      await user.keyboard("{ArrowUp}");
      expect(articles[0]).toHaveFocus();

      const openTab = screen.getByRole("tab", { name: "Em aberto" });
      openTab.focus();
      await user.keyboard("{ArrowRight}");

      const resolvedTab = screen.getByRole("tab", { name: "Resolvidas" });
      expect(resolvedTab).toHaveFocus();
      expect(resolvedTab).toHaveAttribute("aria-selected", "true");
    });
  });
});
