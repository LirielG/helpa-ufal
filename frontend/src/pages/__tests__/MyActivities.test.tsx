import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router";
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
import { MyActivities } from "../MyActivities";

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname + location.search}
    </output>
  );
}

function renderMyActivities(route = "/my-activities") {
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
        <Route path="/my-activities" element={<MyActivities />} />
      </Routes>
      <LocationProbe />
    </>,
    { route },
  );
}

const location = () => screen.getByTestId("location").textContent;

describe("MyActivities page", () => {
  it("renders Atividades Inscritas and normalizes URL when no filter is provided", async () => {
    renderMyActivities("/my-activities");

    const heading = await screen.findByRole("heading", {
      name: "Atividades Inscritas",
    });
    expect(heading).toBeInTheDocument();
    expect(location()).toBe("/my-activities?filter=enrolled");

    // Must not have horizontal sub-tabs
    const main = screen.getByRole("main");
    expect(
      within(main).queryByRole("button", { name: "Atividades Concluídas" }),
    ).toBeNull();
  });

  it("normalizes an invalid filter to enrolled with replace", async () => {
    renderMyActivities("/my-activities?filter=invalid-filter");

    const heading = await screen.findByRole("heading", {
      name: "Atividades Inscritas",
    });
    expect(heading).toBeInTheDocument();
    expect(location()).toBe("/my-activities?filter=enrolled");
  });

  it("renders Atividades Concluídas when ?filter=completed", async () => {
    renderMyActivities("/my-activities?filter=completed");

    const heading = await screen.findByRole("heading", {
      name: "Atividades Concluídas",
    });
    expect(heading).toBeInTheDocument();
    expect(location()).toBe("/my-activities?filter=completed");
  });

  it("renders Atividades Gerenciadas when ?filter=managed", async () => {
    renderMyActivities("/my-activities?filter=managed");

    const heading = await screen.findByRole("heading", {
      name: "Atividades Gerenciadas",
    });
    expect(heading).toBeInTheDocument();
    expect(location()).toBe("/my-activities?filter=managed");
  });
});
