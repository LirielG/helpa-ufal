import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router";
import { render, screen, waitFor, within } from "@/test/render";
import { API, http, HttpResponse, server } from "@/test/http";
import { signIn } from "@/test/auth";
import { makeActionDetail, makeUser } from "@/test/factories";
import type { Activity } from "@/services/contracts/activity";
import { ActionDetail } from "../ActionDetail";

const ACTION_ID = "act-moderated";
const AUTHOR_ID = "author-moderated";
const REMOVED_MESSAGE = "Esta ação foi removida pela moderação.";
const TITLE = "Título da ação removida";

const ACTIVITY_REMOVED = {
  status: 410,
  code: "ACTIVITY_REMOVED",
  message: "This activity was removed by moderation.",
};

function removedActivityResponse() {
  return HttpResponse.json(ACTIVITY_REMOVED, { status: 410 });
}

function moderatedAction(overrides: Partial<Activity> = {}): Activity {
  return makeActionDetail({
    id: ACTION_ID,
    authorId: AUTHOR_ID,
    title: TITLE,
    status: "OPEN",
    moderation: {
      removedAt: "2026-09-10T15:00:00.000Z",
      justification: "Ação viola as diretrizes.",
    },
    ...overrides,
  });
}

function openAction(overrides: Partial<Activity> = {}): Activity {
  return makeActionDetail({
    id: ACTION_ID,
    authorId: AUTHOR_ID,
    title: TITLE,
    status: "OPEN",
    availableSlots: 5,
    ...overrides,
  });
}

/** Answers GET /activities/:id with each response in turn, repeating the last. */
function serveDetail(...responses: (() => Response)[]) {
  let calls = 0;
  server.use(
    http.get(`${API}/activities/${ACTION_ID}`, () => {
      const respond = responses[Math.min(calls, responses.length - 1)];
      calls += 1;
      return respond();
    }),
  );
  return () => calls;
}

function renderPage() {
  return render(
    <Routes>
      <Route path="/activity/:id" element={<ActionDetail />} />
      <Route path="/dashboard" element={<h1>Explorar</h1>} />
    </Routes>,
    { route: `/activity/${ACTION_ID}` },
  );
}

describe("ActionDetail of an action removed by moderation", () => {
  describe("to the public (410)", () => {
    it.each([
      ["a visitor", null],
      ["a signed-in regular user", "regular-user"],
    ])(
      "tells %s the action was removed and links to the feed",
      async (_who, userId) => {
        if (userId) signIn(makeUser({ id: userId }));
        serveDetail(removedActivityResponse);
        renderPage();

        expect(await screen.findByText(REMOVED_MESSAGE)).toBeInTheDocument();
        expect(
          screen.getByRole("link", { name: "Explorar ações" }),
        ).toHaveAttribute("href", "/dashboard");
        expect(screen.queryByText(TITLE)).not.toBeInTheDocument();
        expect(screen.queryByText(/Justificativa/)).not.toBeInTheDocument();
      },
    );

    it("titles the tab without the action's title", async () => {
      serveDetail(removedActivityResponse);
      renderPage();

      await screen.findByText(REMOVED_MESSAGE);
      expect(document.title).not.toContain(TITLE);
    });
  });

  describe("to the author and managers (200 with moderation)", () => {
    it.each([
      ["the author", { id: AUTHOR_ID }],
      ["a manager", { id: "manager-1", isManager: true }],
    ])(
      "shows %s the notice with date and justification, and no action button",
      async (_who, user) => {
        signIn(makeUser(user));
        serveDetail(() =>
          HttpResponse.json(moderatedAction({ enrollmentStatus: "APPROVED" })),
        );
        renderPage();

        const notice = await screen.findByRole("status");
        expect(notice).toHaveTextContent(
          "Esta ação foi removida pela moderação em 10/09/2026.",
        );
        expect(notice).toHaveTextContent(
          "Justificativa: Ação viola as diretrizes.",
        );
        expect(
          screen.getByRole("heading", { level: 1, name: TITLE }),
        ).toBeInTheDocument();

        for (const name of [
          /Inscrever-se/,
          /Cancelar inscrição/,
          /Denunciar ação/,
          /Ver inscritos/,
          /Editar/,
        ]) {
          expect(
            screen.queryByRole("button", { name }),
          ).not.toBeInTheDocument();
        }
        expect(screen.queryByText("Inscrito")).not.toBeInTheDocument();
      },
    );

    it("leaves the justification line out when the decision carried none", async () => {
      signIn(makeUser({ id: AUTHOR_ID }));
      serveDetail(() =>
        HttpResponse.json(
          moderatedAction({
            moderation: {
              removedAt: "2026-09-10T15:00:00.000Z",
              justification: null,
            },
          }),
        ),
      );
      renderPage();

      const notice = await screen.findByRole("status");
      expect(notice).toHaveTextContent(
        "Esta ação foi removida pela moderação em 10/09/2026.",
      );
      expect(notice).not.toHaveTextContent("Justificativa");
    });
  });

  describe("a write answered with 410", () => {
    it("shows the toast and reloads the page when enrolling", async () => {
      signIn(makeUser({ id: "regular-user" }));
      serveDetail(
        () => HttpResponse.json(openAction()),
        removedActivityResponse,
      );
      server.use(
        http.put(
          `${API}/activities/${ACTION_ID}/enrollments/me`,
          removedActivityResponse,
        ),
      );
      const { user } = renderPage();

      await user.click(
        await screen.findByRole("button", { name: /Inscrever-se/ }),
      );
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Confirmar",
        }),
      );

      expect(
        await screen.findByRole("link", { name: "Explorar ações" }),
      ).toBeInTheDocument();
      expect(screen.getAllByText(REMOVED_MESSAGE).length).toBeGreaterThan(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows the toast and reloads the page when cancelling the enrollment", async () => {
      signIn(makeUser({ id: "regular-user" }));
      serveDetail(
        () => HttpResponse.json(openAction({ enrollmentStatus: "APPROVED" })),
        removedActivityResponse,
      );
      server.use(
        http.delete(
          `${API}/activities/${ACTION_ID}/enrollments/me`,
          removedActivityResponse,
        ),
      );
      const { user } = renderPage();

      await user.click(
        await screen.findByRole("button", { name: "Cancelar inscrição" }),
      );
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Cancelar inscrição",
        }),
      );

      expect(
        await screen.findByRole("link", { name: "Explorar ações" }),
      ).toBeInTheDocument();
      expect(screen.getAllByText(REMOVED_MESSAGE).length).toBeGreaterThan(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows the toast and reloads the page when reporting", async () => {
      signIn(makeUser({ id: "regular-user" }));
      const detailCalls = serveDetail(
        () => HttpResponse.json(openAction()),
        removedActivityResponse,
      );
      server.use(
        http.post(
          `${API}/activities/${ACTION_ID}/reports`,
          removedActivityResponse,
        ),
      );
      const { user } = renderPage();

      await user.click(
        await screen.findByRole("button", { name: "Denunciar ação" }),
      );
      await user.click(
        screen.getByRole("radio", { name: "Spam ou divulgação indevida" }),
      );
      await user.click(screen.getByRole("button", { name: "Denunciar" }));

      expect(
        await screen.findByRole("link", { name: "Explorar ações" }),
      ).toBeInTheDocument();
      expect(screen.getAllByText(REMOVED_MESSAGE).length).toBeGreaterThan(1);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      await waitFor(() => expect(detailCalls()).toBe(2));
    });

    it("shows the author the notice after a write refused while the page was open", async () => {
      signIn(makeUser({ id: AUTHOR_ID }));
      serveDetail(
        () => HttpResponse.json(openAction({ enrollmentStatus: null })),
        () => HttpResponse.json(moderatedAction()),
      );
      server.use(
        http.put(
          `${API}/activities/${ACTION_ID}/enrollments/me`,
          removedActivityResponse,
        ),
      );
      const { user } = renderPage();

      await user.click(
        await screen.findByRole("button", { name: /Inscrever-se/ }),
      );
      await user.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Confirmar",
        }),
      );

      expect(await screen.findByRole("status")).toHaveTextContent(
        "Justificativa: Ação viola as diretrizes.",
      );
      expect(
        screen.queryByRole("button", { name: /Inscrever-se/ }),
      ).not.toBeInTheDocument();
    });
  });
});
