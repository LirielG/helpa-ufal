import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import { http, HttpResponse, server } from "@/test/http";
import { makeEnrollment } from "@/test/factories";

import { EnrollmentsPage } from "@/pages/EnrollmentsPage";

const API = process.env.VITE_API_URL || "http://localhost:3333/api";

/** Renders EnrollmentsPage mounted at the route /activity/act-1/enrollments. */
function renderPage() {
  return render(<EnrollmentsPage />, {
    route: "/activity/act-1/enrollments",
    path: "/activity/:id/enrollments",
  });
}

describe("EnrollmentsPage", () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe("loaded list", () => {
    it("displays enrolled volunteers with name, email and registration code", async () => {
      const enrollment = makeEnrollment({
        fullName: "Maria Silva",
        email: "maria@ufal.br",
        registrationCode: "12345678",
      });

      server.use(
        http.get(`${API}/activities/:id/enrollments`, () =>
          HttpResponse.json({
            items: [enrollment],
            total: 1,
            page: 1,
            limit: 20,
            totalPresent: 0,
          }),
        ),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Maria Silva")).toBeInTheDocument();
      });

      expect(screen.getByText("maria@ufal.br")).toBeInTheDocument();
      expect(screen.getByText("12345678")).toBeInTheDocument();
    });

    it("shows total enrollment count in the header", async () => {
      server.use(
        http.get(`${API}/activities/:id/enrollments`, () =>
          HttpResponse.json({
            items: [makeEnrollment(), makeEnrollment()],
            total: 2,
            page: 1,
            limit: 20,
            totalPresent: 0,
          }),
        ),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/2/)).toBeInTheDocument();
      });
    });

    it("renders normally with attendanceConfirmed null and confirmedWorkloadHours 0 (pre-#146 state)", async () => {
      // This is the structural state before #146 is delivered.
      // The page must NOT treat it as an error.
      const enrollment = makeEnrollment({
        attendanceConfirmed: null,
        confirmedWorkloadHours: 0,
      });

      server.use(
        http.get(`${API}/activities/:id/enrollments`, () =>
          HttpResponse.json({
            items: [enrollment],
            total: 1,
            page: 1,
            limit: 20,
            totalPresent: 0,
          }),
        ),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(enrollment.fullName)).toBeInTheDocument();
      });

      // No error alert should be rendered
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("teacher with null registrationCode", () => {
    it("renders an empty cell instead of 'null'", async () => {
      const teacher = makeEnrollment({
        fullName: "Prof. João",
        email: "joao@ufal.br",
        registrationCode: null, // teacher has no registration code
      });

      server.use(
        http.get(`${API}/activities/:id/enrollments`, () =>
          HttpResponse.json({
            items: [teacher],
            total: 1,
            page: 1,
            limit: 20,
            totalPresent: 0,
          }),
        ),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Prof. João")).toBeInTheDocument();
      });

      // The literal string "null" must never appear in the document
      expect(screen.queryByText("null")).not.toBeInTheDocument();
    });
  });

  describe("empty list", () => {
    it("shows an empty state message, not a blank table", async () => {
      server.use(
        http.get(`${API}/activities/:id/enrollments`, () =>
          HttpResponse.json({
            items: [],
            total: 0,
            page: 1,
            limit: 20,
            totalPresent: 0,
          }),
        ),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText(/Nenhum inscrito ainda/)).toBeInTheDocument();
      });

      // Table must not be rendered when there are no items
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("403 Forbidden", () => {
    it("displays pt-BR permission message and no enrollment data", async () => {
      server.use(
        http.get(`${API}/activities/:id/enrollments`, () =>
          HttpResponse.json(
            { message: "Forbidden" },
            { status: 403 },
          ),
        ),
      );

      renderPage();

      await waitFor(() => {
        expect(
          screen.getByText(/Você não tem permissão/),
        ).toBeInTheDocument();
      });

      // No table should be visible
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("404 Not Found", () => {
    it("displays pt-BR message when activity does not exist", async () => {
      server.use(
        http.get(`${API}/activities/:id/enrollments`, () =>
          HttpResponse.json(
            { message: "Activity not found" },
            { status: 404 },
          ),
        ),
      );

      renderPage();

      await waitFor(() => {
        expect(
          screen.getByText(/A ação não foi encontrada/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("network error", () => {
    it("displays pt-BR error message and a retry button", async () => {
      server.use(
        http.get(`${API}/activities/:id/enrollments`, () =>
          HttpResponse.error(),
        ),
      );

      renderPage();


      await waitFor(() => {
        expect(screen.getByText(/Falha de comunicação/)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole("button", {
        name: /Tentar novamente/i,
      });
      expect(retryButton).toBeInTheDocument();

      // After retry, the button should still be clickable (no lock)
      expect(retryButton).not.toBeDisabled();
    });

    it("reloads data when retry button is clicked after a network error", async () => {
      let callCount = 0;

      server.use(
        http.get(`${API}/activities/:id/enrollments`, () => {
          callCount += 1;

          if (callCount === 1) {
            return HttpResponse.error();
          }

          return HttpResponse.json({
            items: [makeEnrollment({ fullName: "Ana Lima" })],
            total: 1,
            page: 1,
            limit: 20,
            totalPresent: 0,
          });
        }),
      );

      const { user } = renderPage();

      // Wait for the error state
      await waitFor(() => {
        expect(screen.getByText(/Falha de comunicação/)).toBeInTheDocument();
      });

      // Click retry
      await user.click(screen.getByRole("button", { name: /Tentar novamente/i }));

      // Data should now load
      await waitFor(() => {
        expect(screen.getByText("Ana Lima")).toBeInTheDocument();
      });
    });
  });

  describe("pagination", () => {
    it("renders pagination controls when total exceeds page limit", async () => {
      // 25 items with limit 20 → 2 pages
      server.use(
        http.get(`${API}/activities/:id/enrollments`, () =>
          HttpResponse.json({
            items: Array.from({ length: 20 }, () => makeEnrollment()),
            total: 25,
            page: 1,
            limit: 20,
            totalPresent: 0,
          }),
        ),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByRole("navigation", { name: /Paginação/i })).toBeInTheDocument();
      });
    });

    it("does not render pagination when all items fit on one page", async () => {
      server.use(
        http.get(`${API}/activities/:id/enrollments`, () =>
          HttpResponse.json({
            items: [makeEnrollment()],
            total: 1,
            page: 1,
            limit: 20,
            totalPresent: 0,
          }),
        ),
      );

      renderPage();

      await waitFor(() => {
        expect(screen.getByText("Voluntário de Teste")).toBeInTheDocument();
      });

      expect(
        screen.queryByRole("navigation", { name: /Paginação/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows loading indicator while fetching", () => {
      // The default handler is delayed via msw; the component should show
      // "Carregando inscritos…" before the response arrives.
      renderPage();

      expect(screen.getByText(/Carregando inscritos/)).toBeInTheDocument();
    });
  });
});
