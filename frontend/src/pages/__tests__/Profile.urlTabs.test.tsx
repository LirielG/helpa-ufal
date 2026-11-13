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
  within,
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
      <button type="button" onClick={() => navigate("/profile")}>
        go-profile
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
// The dashboard sidebar repeats the tab labels, so the queries stay inside
// the page content.
const getTab = (name: string) =>
  within(screen.getByRole("main")).getByRole("button", { name });
const findTab = async (name: string) =>
  within(await screen.findByRole("main")).findByRole("button", { name });

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
    expect(getTab("Atividades Concluídas")).toHaveAttribute(
      "aria-current",
      "page",
    );
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

    await user.click(getTab("Ações"));
    expect(location()).toBe("/profile?tab=actions");

    await user.click(await findTab("Atividades Gerenciadas"));
    expect(location()).toBe("/profile?tab=actions&filter=managed");

    await user.click(getTab("Atividades Inscritas"));
    expect(location()).toBe("/profile?tab=actions");

    await user.click(getTab("Atividades Gerenciadas"));
    await user.click(getTab("Dados Pessoais"));
    expect(location()).toBe("/profile");
  });

  it("does not stack the tab clicks in the history", async () => {
    const { user } = renderProfile("/other");
    await user.click(screen.getByRole("button", { name: "go-profile" }));
    await isOnPersonal();

    await user.click(getTab("Ações"));
    await user.click(await findTab("Atividades Gerenciadas"));
    await user.click(screen.getByRole("button", { name: "history-back" }));

    expect(location()).toBe("/other");
  });

  it("restores both selections on Back after leaving the profile", async () => {
    const { user } = renderProfile("/profile");
    await isOnPersonal();

    await user.click(getTab("Ações"));
    await user.click(await findTab("Atividades Gerenciadas"));
    await user.click(screen.getByRole("button", { name: "go-other" }));
    expect(await screen.findByText("outra página")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "history-back" }));

    expect(location()).toBe("/profile?tab=actions&filter=managed");
    expect(await findTab("Atividades Gerenciadas")).toBeInTheDocument();
    expect(getTab("Atividades Gerenciadas")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
