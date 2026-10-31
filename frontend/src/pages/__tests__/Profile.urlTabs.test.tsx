import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation, useNavigate } from "react-router";
import {
  API,
  HttpResponse,
  http,
  render,
  screen,
  server,
  signIn,
} from "@/test";
import { useAuthStore } from "@/stores/authStore";
import { Profile } from "../Profile";

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">
        {location.pathname + location.search}
      </output>
      <button type="button" onClick={() => navigate(-1)}>
        history-back
      </button>
      <button type="button" onClick={() => navigate("/other")}>
        go-other
      </button>
    </>
  );
}

function renderProfile(route: string) {
  signIn();
  useAuthStore.setState({ isSessionVerified: true });
  const user = useAuthStore.getState().user!;
  server.use(
    http.get(`${API}/users/me`, () =>
      HttpResponse.json({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        userType: user.userType,
        isManager: user.isManager,
        createdAt: user.createdAt,
        registrationCode: "2026000001",
        course: "Ciência da Computação",
        cndb: null,
        totalWorkloadHours: 0,
      }),
    ),
    http.get(`${API}/users/me/activities`, () =>
      HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        limit: 100,
        totalPages: 1,
      }),
    ),
  );

  return render(
    <>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="/other" element={<p>outra página</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route },
  );
}

const location = () => screen.getByTestId("location").textContent;
const isOnPersonal = () => screen.findByLabelText("Nome completo");
const isActive = (name: string) =>
  screen.getByRole("button", { name }).className.includes("border-[#1B75BB]");

describe("Profile tab in the URL", () => {
  it("shows Dados Pessoais without a parameter", async () => {
    renderProfile("/profile");
    expect(await isOnPersonal()).toBeInTheDocument();
  });

  it.each(["xyz", "certificates"])(
    "shows Dados Pessoais for the invalid tab %s, without error",
    async (tab) => {
      renderProfile(`/profile?tab=${tab}`);
      expect(await isOnPersonal()).toBeInTheDocument();
    },
  );

  it("reads tab and filter from the URL", async () => {
    renderProfile("/profile?tab=actions&filter=completed");
    expect(
      await screen.findByText("Você ainda não concluiu nenhuma ação."),
    ).toBeInTheDocument();
    expect(isActive("Atividades Concluídas")).toBe(true);
  });

  it("falls back to enrolled for an invalid filter", async () => {
    renderProfile("/profile?tab=actions&filter=xyz");
    expect(
      await screen.findByText(
        "Você não está inscrito em nenhuma ação no momento.",
      ),
    ).toBeInTheDocument();
  });

  it("writes the tab and the sub-tab, and drops the filter on leaving", async () => {
    const { user } = renderProfile("/profile");
    await isOnPersonal();

    await user.click(screen.getByRole("button", { name: "Ações" }));
    expect(location()).toBe("/profile?tab=actions");

    await user.click(
      await screen.findByRole("button", { name: "Atividades Gerenciadas" }),
    );
    expect(location()).toBe("/profile?tab=actions&filter=managed");

    await user.click(
      screen.getByRole("button", { name: "Atividades Inscritas" }),
    );
    expect(location()).toBe("/profile?tab=actions");

    await user.click(
      screen.getByRole("button", { name: "Atividades Gerenciadas" }),
    );
    await user.click(screen.getByRole("button", { name: "Dados Pessoais" }));
    expect(location()).toBe("/profile");
  });

  it("replaces history entries: Back after leaving restores both selections", async () => {
    const { user } = renderProfile("/profile");
    await isOnPersonal();

    await user.click(screen.getByRole("button", { name: "Ações" }));
    await user.click(
      await screen.findByRole("button", { name: "Atividades Gerenciadas" }),
    );
    await user.click(screen.getByRole("button", { name: "go-other" }));
    expect(await screen.findByText("outra página")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "history-back" }));

    expect(location()).toBe("/profile?tab=actions&filter=managed");
    expect(
      await screen.findByRole("button", { name: "Atividades Gerenciadas" }),
    ).toBeInTheDocument();
    expect(isActive("Atividades Gerenciadas")).toBe(true);
  });
});
