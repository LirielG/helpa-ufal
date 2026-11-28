import { afterEach, describe, expect, it, vi } from "vitest";
import { render as rtlRender } from "@testing-library/react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { render, screen, userEvent } from "@/test";
import { BackLink } from "../BackLink";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="pathname">{location.pathname}</div>;
}

describe("BackLink", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("renders '← Voltar' by default and allows customizing the label", () => {
    render(
      <>
        <BackLink />
        <BackLink label="Voltar para a Seleção de Cadastro" />
        <BackLink label="← Voltar ao início" />
      </>,
    );

    expect(screen.getByRole("link", { name: "← Voltar" })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(
      screen.getByRole("link", { name: "← Voltar para a Seleção de Cadastro" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "← Voltar ao início" }),
    ).toBeInTheDocument();
  });

  it("returns to the previous page when there is internal app history", async () => {
    const { user } = render(
      <>
        <LocationProbe />
        <Routes>
          <Route
            path="/my-activities"
            element={
              <div>
                <h1>Minhas atividades</h1>
                <Link to="/activity/1">Abrir ação</Link>
              </div>
            }
          />
          <Route
            path="/activity/1"
            element={
              <div>
                <h1>Detalhe da ação</h1>
                <BackLink />
              </div>
            }
          />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        </Routes>
      </>,
      { route: "/my-activities" },
    );

    await user.click(screen.getByRole("link", { name: "Abrir ação" }));
    expect(
      screen.getByRole("heading", { name: "Detalhe da ação" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "← Voltar" }));

    expect(
      screen.getByRole("heading", { name: "Minhas atividades" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/my-activities");
  });

  it("falls back to /dashboard when opened directly without internal history", async () => {
    const { user } = render(
      <>
        <LocationProbe />
        <Routes>
          <Route path="/activity/1" element={<BackLink />} />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        </Routes>
      </>,
      { route: "/activity/1" },
    );

    await user.click(screen.getByRole("link", { name: "← Voltar" }));

    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/dashboard");
  });

  it("uses the custom fallbackTo route when opened directly without internal history", async () => {
    const { user } = render(
      <>
        <LocationProbe />
        <Routes>
          <Route
            path="/activity/act-1/enrollments"
            element={<BackLink fallbackTo="/activity/act-1" />}
          />
          <Route path="/activity/act-1" element={<h1>Detalhe da ação</h1>} />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        </Routes>
      </>,
      { route: "/activity/act-1/enrollments" },
    );

    const backLink = screen.getByRole("link", { name: "← Voltar" });
    expect(backLink).toHaveAttribute("href", "/activity/act-1");

    await user.click(backLink);

    expect(
      screen.getByRole("heading", { name: "Detalhe da ação" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/activity/act-1");
  });

  it("falls back to fallbackTo in BrowserRouter when direct entry was replaced (idx === 0)", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/old-entry");

    rtlRender(
      <BrowserRouter>
        <LocationProbe />
        <Routes>
          <Route
            path="/old-entry"
            element={<Navigate to="/activity/1" replace />}
          />
          <Route path="/activity/1" element={<BackLink />} />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        </Routes>
      </BrowserRouter>,
    );

    expect(screen.getByTestId("pathname")).toHaveTextContent("/activity/1");

    await user.click(screen.getByRole("link", { name: "← Voltar" }));

    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/dashboard");
  });

  it("goes back in BrowserRouter when the user navigated internally (idx > 0)", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/profile");

    rtlRender(
      <BrowserRouter>
        <LocationProbe />
        <Routes>
          <Route
            path="/profile"
            element={
              <div>
                <h1>Perfil</h1>
                <Link to="/activity/1">Abrir ação</Link>
              </div>
            }
          />
          <Route path="/activity/1" element={<BackLink />} />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        </Routes>
      </BrowserRouter>,
    );

    await user.click(screen.getByRole("link", { name: "Abrir ação" }));
    expect(screen.getByTestId("pathname")).toHaveTextContent("/activity/1");

    await user.click(screen.getByRole("link", { name: "← Voltar" }));

    expect(
      await screen.findByRole("heading", { name: "Perfil" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/profile");
  });

  it("runs a custom onClick handler without navigating away", async () => {
    const onClick = vi.fn();
    const { user } = render(
      <>
        <LocationProbe />
        <Routes>
          <Route
            path="/login"
            element={<Link to="/register">Criar conta</Link>}
          />
          <Route
            path="/register"
            element={
              <BackLink
                label="Voltar para a Seleção de Cadastro"
                fallbackTo="/register"
                onClick={onClick}
              />
            }
          />
        </Routes>
      </>,
      { route: "/login" },
    );

    await user.click(screen.getByRole("link", { name: "Criar conta" }));
    await user.click(
      screen.getByRole("link", { name: "← Voltar para a Seleção de Cadastro" }),
    );

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByTestId("pathname")).toHaveTextContent("/register");
  });
});
