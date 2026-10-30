import { describe, it, expect } from "vitest";
import { Route, Routes } from "react-router";
import {
  API,
  http,
  HttpResponse,
  makeActionDetail,
  makeEnrollment,
  makeManager,
  render,
  screen,
  server,
  signIn,
} from "@/test";
import { ActionDetail } from "../ActionDetail";
import { EnrollmentsPage } from "../EnrollmentsPage";

const ACTION_ID = "act-enrollments-entry";

function renderDetailWithEnrollmentsRoute(authorId = "author-1") {
  server.use(
    http.get(`${API}/activities/${ACTION_ID}`, () =>
      HttpResponse.json(makeActionDetail({ id: ACTION_ID, authorId })),
    ),
  );

  return render(
    <Routes>
      <Route path="/activity/:id" element={<ActionDetail />} />
      <Route path="/activity/:id/enrollments" element={<EnrollmentsPage />} />
    </Routes>,
    { route: `/activity/${ACTION_ID}` },
  );
}

describe("ActionDetail enrollments button", () => {
  it("shows Ver inscritos to a manager who is not the creator and navigates to the action's enrollment list", async () => {
    signIn(makeManager({ id: "manager-1" }));
    server.use(
      http.get(`${API}/activities/${ACTION_ID}/enrollments`, () =>
        HttpResponse.json({
          items: [
            makeEnrollment({
              activityId: ACTION_ID,
              user: { fullName: "Maria Silva" },
            }),
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPresent: 0,
        }),
      ),
    );
    const { user } = renderDetailWithEnrollmentsRoute("author-1");

    const viewEnrollmentsButton = await screen.findByRole("button", {
      name: "Ver inscritos",
    });
    expect(viewEnrollmentsButton).toBeEnabled();

    await user.click(viewEnrollmentsButton);

    expect(
      await screen.findByRole("heading", { name: "Inscritos" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();
  });

  it("shows Ver inscritos to the creator on their own action and navigates to the enrollment list", async () => {
    signIn({ id: "author-1", isManager: false });
    server.use(
      http.get(`${API}/activities/${ACTION_ID}/enrollments`, () =>
        HttpResponse.json({
          items: [
            makeEnrollment({
              activityId: ACTION_ID,
              user: { fullName: "João Pereira" },
            }),
          ],
          total: 1,
          page: 1,
          limit: 20,
          totalPresent: 0,
        }),
      ),
    );
    const { user } = renderDetailWithEnrollmentsRoute("author-1");

    await user.click(
      await screen.findByRole("button", { name: "Ver inscritos" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Inscritos" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("João Pereira")).toBeInTheDocument();
  });

  it("hides Ver inscritos from a regular signed-in user who is not the creator", async () => {
    signIn({ id: "regular-user", isManager: false });
    renderDetailWithEnrollmentsRoute("author-1");

    await screen.findByRole("button", { name: /Inscrever-se/ });

    expect(
      screen.queryByRole("button", { name: "Ver inscritos" }),
    ).not.toBeInTheDocument();
  });

  it("hides Ver inscritos from an anonymous visitor", async () => {
    renderDetailWithEnrollmentsRoute("author-1");

    await screen.findByRole("heading", { name: "Oficina de Programação" });

    expect(
      screen.queryByRole("button", { name: "Ver inscritos" }),
    ).not.toBeInTheDocument();
  });

  it("lets EnrollmentsPage surface a 403 when the server denies access after clicking Ver inscritos", async () => {
    signIn(makeManager({ id: "stale-manager" }));
    server.use(
      http.get(`${API}/activities/${ACTION_ID}/enrollments`, () =>
        HttpResponse.json({ message: "Forbidden" }, { status: 403 }),
      ),
    );
    const { user } = renderDetailWithEnrollmentsRoute("author-1");

    await user.click(
      await screen.findByRole("button", { name: "Ver inscritos" }),
    );

    expect(
      await screen.findByText(/Você não tem permissão/),
    ).toBeInTheDocument();
  });
});
