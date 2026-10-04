import { describe, it, expect } from "vitest";
import { render, screen } from "@/test/render";
import { API, http, HttpResponse, server } from "@/test/http";
import { makeActionDetail } from "@/test/factories";
import { signIn } from "@/test/auth";
import { ActionDetail } from "../ActionDetail";

const ACTION_ID = "act-report-page";

function renderPage(authorId = "author-1") {
  server.use(
    http.get(`${API}/activities/${ACTION_ID}`, () =>
      HttpResponse.json(makeActionDetail({ id: ACTION_ID, authorId })),
    ),
  );

  return render(<ActionDetail />, {
    route: `/activity/${ACTION_ID}`,
    path: "/activity/:id",
  });
}

describe("ActionDetail report button", () => {
  it("is shown to a signed-in user who is not the author", async () => {
    signIn({ id: "someone-else" });
    renderPage("author-1");

    expect(
      await screen.findByRole("button", { name: "Denunciar ação" }),
    ).toBeEnabled();
  });

  it("is hidden from an anonymous visitor", async () => {
    renderPage();

    await screen.findByText("Oficina de Programação", { selector: "h1" });

    expect(
      screen.queryByRole("button", { name: "Denunciar ação" }),
    ).not.toBeInTheDocument();
  });

  it("is hidden from the action's author", async () => {
    signIn({ id: "author-1" });
    renderPage("author-1");

    await screen.findByRole("button", { name: /Inscrever-se/ });

    expect(
      screen.queryByRole("button", { name: "Denunciar ação" }),
    ).not.toBeInTheDocument();
  });

  it("opens the modal, reports, then disables the button and keeps focus on it", async () => {
    signIn({ id: "someone-else" });
    server.use(
      http.post(`${API}/activities/${ACTION_ID}/reports`, () =>
        HttpResponse.json(
          {
            id: "report-1",
            activityId: ACTION_ID,
            userId: "someone-else",
            category: "SPAM",
            description: null,
            createdAt: "2026-01-01T12:00:00.000Z",
          },
          { status: 201 },
        ),
      ),
    );
    const { user } = renderPage("author-1");

    await user.click(
      await screen.findByRole("button", { name: "Denunciar ação" }),
    );
    await user.click(
      screen.getByRole("radio", { name: "Spam ou divulgação indevida" }),
    );
    await user.click(screen.getByRole("button", { name: "Denunciar" }));

    expect(await screen.findByText("Denúncia registrada")).toBeInTheDocument();

    await user.click(screen.getByText("Fechar", { selector: "button" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const reportedButton = screen.getByRole("button", {
      name: "Ação denunciada",
    });
    expect(reportedButton).toHaveAttribute("aria-disabled", "true");
    expect(reportedButton).toHaveFocus();

    await user.click(reportedButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
