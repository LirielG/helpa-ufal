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
import { MyActivities } from "../MyActivities";
import { DashboardShell } from "@/features/dashboard/components/DashboardShell";

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
      <button
        type="button"
        onClick={() => navigate("/profile?tab=actions&filter=managed")}
      >
        go-legacy-actions
      </button>
    </>
  );
}

function renderWithRoutes(route: string) {
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
        <Route element={<DashboardShell />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/my-activities" element={<MyActivities />} />
        </Route>
        <Route path="/other" element={<p>outra página</p>} />
      </Routes>
      <LocationProbe />
    </>,
    { route },
  );
}

const location = () => screen.getByTestId("location").textContent;
const isOnPersonal = () => screen.findByLabelText("Nome completo");

describe("Profile tab in the URL and legacy redirects", () => {
  it("shows Dados Pessoais without a parameter and contains no tabs", async () => {
    renderWithRoutes("/profile");
    expect(await isOnPersonal()).toBeInTheDocument();
    // Profile should not contain any sub-tabs or actions tab inside main
    const main = screen.getByRole("main");
    expect(within(main).queryByRole("button", { name: "Ações" })).toBeNull();
    expect(
      within(main).queryByRole("button", { name: "Atividades Inscritas" }),
    ).toBeNull();
  });

  it.each(["xyz", "certificates"])(
    "shows Dados Pessoais for the invalid tab %s, without error",
    async (tab) => {
      renderWithRoutes(`/profile?tab=${tab}`);
      expect(await isOnPersonal()).toBeInTheDocument();
    },
  );

  it("redirects legacy /profile?tab=actions to /my-activities?filter=enrolled", async () => {
    renderWithRoutes("/profile?tab=actions");
    expect(
      await screen.findByRole("heading", { name: "Atividades Inscritas" }),
    ).toBeInTheDocument();
    expect(location()).toBe("/my-activities?filter=enrolled");
  });

  it("redirects legacy /profile?tab=actions&filter=completed to /my-activities?filter=completed", async () => {
    renderWithRoutes("/profile?tab=actions&filter=completed");
    expect(
      await screen.findByRole("heading", { name: "Atividades Concluídas" }),
    ).toBeInTheDocument();
    expect(location()).toBe("/my-activities?filter=completed");
  });

  it("redirects legacy /profile?tab=actions&filter=managed to /my-activities?filter=managed", async () => {
    renderWithRoutes("/profile?tab=actions&filter=managed");
    expect(
      await screen.findByRole("heading", { name: "Atividades Gerenciadas" }),
    ).toBeInTheDocument();
    expect(location()).toBe("/my-activities?filter=managed");
  });

  it("normalizes an invalid filter on legacy redirect to enrolled", async () => {
    renderWithRoutes("/profile?tab=actions&filter=xyz");
    expect(
      await screen.findByRole("heading", { name: "Atividades Inscritas" }),
    ).toBeInTheDocument();
    expect(location()).toBe("/my-activities?filter=enrolled");
  });

  it("redirects the old sidebar link /profile?section=completed", async () => {
    renderWithRoutes("/profile?section=completed&tab=actions");
    expect(
      await screen.findByRole("heading", { name: "Atividades Concluídas" }),
    ).toBeInTheDocument();
    expect(location()).toBe("/my-activities?filter=completed");
  });

  it("does not stack the legacy redirect in the history", async () => {
    const { user } = renderWithRoutes("/other");
    await user.click(screen.getByRole("button", { name: "go-legacy-actions" }));
    expect(
      await screen.findByRole("heading", { name: "Atividades Gerenciadas" }),
    ).toBeInTheDocument();
    expect(location()).toBe("/my-activities?filter=managed");

    await user.click(screen.getByRole("button", { name: "history-back" }));
    expect(location()).toBe("/other");
  });

  it("restores filter on Back after leaving /my-activities", async () => {
    const { user } = renderWithRoutes("/my-activities?filter=managed");
    expect(
      await screen.findByRole("heading", { name: "Atividades Gerenciadas" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "go-other" }));
    expect(await screen.findByText("outra página")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "history-back" }));

    expect(location()).toBe("/my-activities?filter=managed");
    expect(
      await screen.findByRole("heading", { name: "Atividades Gerenciadas" }),
    ).toBeInTheDocument();
  });
});
