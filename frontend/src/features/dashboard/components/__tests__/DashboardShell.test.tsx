import { describe, expect, it, beforeEach, vi } from "vitest";
import { screen, act, waitFor, fireEvent } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { useLocation } from "react-router";
import { render, http, HttpResponse, server } from "@/test";
import { useActionRegisterStore } from "@/stores/actionRegisterStore";
import { DashboardShell } from "../DashboardShell";
import { DashboardHeader } from "../DashboardHeader";
import DashboardDefault, * as DashboardModule from "@/pages/Dashboard";

const Dashboard = DashboardDefault || DashboardModule.Dashboard;

vi.mock("../HeroBanner", () => ({
  HeroBanner: () => <div data-testid="hero-banner">Hero Banner</div>,
}));

vi.mock("@/features/dashboard/components/HeroBanner", () => ({
  HeroBanner: () => <div data-testid="hero-banner">Hero Banner</div>,
}));

function LocationTracker() {
  const location = useLocation();
  return <div data-testid="current-pathname">{location.pathname}</div>;
}

function DummyPage({ title }: { title: string }) {
  return (
    <DashboardShell header={<DashboardHeader />}>
      <div>
        <h1>{title}</h1>
        <LocationTracker />
      </div>
    </DashboardShell>
  );
}

function DashboardWithLocation() {
  return (
    <>
      <Dashboard />
      <LocationTracker />
    </>
  );
}

async function fillStep1(user: UserEvent) {
  await user.type(
    screen.getByPlaceholderText("Digite o título da sua ação"),
    "Mutirão de Saúde",
  );

  const selects = screen.getAllByRole("combobox");
  await user.selectOptions(selects[0], "Educação");
  await user.selectOptions(selects[1], "EXTENSION");

  await user.click(screen.getByRole("button", { name: /Próximo/i }));

  await waitFor(() => {
    expect(
      screen.getByRole("heading", { name: "Conte-nos onde e quando será" }),
    ).toBeInTheDocument();
  });
}

async function fillStep2(user: UserEvent) {
  const selects = screen.getAllByRole("combobox");
  await user.selectOptions(selects[0], "ARAPIRACA");
  await user.selectOptions(selects[1], "ONLINE");

  const numberInputs = screen.getAllByRole("spinbutton");
  await user.type(numberInputs[0], "4");
  await user.type(numberInputs[1], "50");

  await user.type(
    screen.getByPlaceholderText(/Ex: https:\/\/meet.google.com/i),
    "https://meet.google.com/abc",
  );

  const startDateInput = screen.getByLabelText(/Início/i, {
    selector: 'input[type="date"]',
  });
  const endDateInput = screen.getByLabelText(/Fim/i, {
    selector: 'input[type="date"]',
  });

  fireEvent.change(startDateInput, { target: { value: "2026-10-10" } });
  fireEvent.change(endDateInput, { target: { value: "2026-10-10" } });
}

describe("DashboardShell", () => {
  beforeEach(() => {
    server.use(
      http.get("*/activities", () => {
        return HttpResponse.json({ content: [] });
      }),
    );
    act(() => {
      useActionRegisterStore.setState({
        isOpen: false,
        onSuccessCallback: undefined,
      });
    });
  });

  it("opens the modal without changing the URL when clicking 'Criar uma ação' on /profile", async () => {
    const { user } = render(<DummyPage title="Perfil" />, {
      route: "/profile",
      path: "*",
    });

    const createButton = screen.getByRole("button", {
      name: /criar uma ação/i,
    });
    await user.click(createButton);

    expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();
    expect(screen.getByTestId("current-pathname")).toHaveTextContent(
      "/profile",
    );
  });

  it("opens the modal without changing the URL when clicking 'Criar uma ação' on /activity/:id", async () => {
    const { user } = render(<DummyPage title="Detalhes da Ação" />, {
      route: "/activity/action-123",
      path: "*",
    });

    const createButton = screen.getByRole("button", {
      name: /criar uma ação/i,
    });
    await user.click(createButton);

    expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();
    expect(screen.getByTestId("current-pathname")).toHaveTextContent(
      "/activity/action-123",
    );
  });

  it("opens the modal without blocking UI when clicking 'Criar uma ação' on /activity/:id/edit", async () => {
    const { user } = render(<DummyPage title="Edição" />, {
      route: "/activity/action-123/edit",
      path: "*",
    });

    const createButton = screen.getByRole("button", {
      name: /criar uma ação/i,
    });
    await user.click(createButton);

    expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();
    expect(screen.getByTestId("current-pathname")).toHaveTextContent(
      "/activity/action-123/edit",
    );
  });

  it("opens the modal in place when clicking 'Criar uma ação' on /dashboard", async () => {
    const { user } = render(<DummyPage title="Dashboard" />, {
      route: "/dashboard",
      path: "*",
    });

    const createButton = screen.getByRole("button", {
      name: /criar uma ação/i,
    });
    await user.click(createButton);

    expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();
    expect(screen.getByTestId("current-pathname")).toHaveTextContent(
      "/dashboard",
    );
  });

  it("returns to the original page without reloading or redirecting when closing the modal", async () => {
    const { user } = render(<DummyPage title="Perfil" />, {
      route: "/profile",
      path: "*",
    });

    const createButton = screen.getByRole("button", {
      name: /criar uma ação/i,
    });
    await user.click(createButton);
    expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: /cancelar/i });
    await user.click(closeButton);

    expect(screen.queryByText("Vamos criar uma ação?")).not.toBeInTheDocument();
    expect(screen.getByTestId("current-pathname")).toHaveTextContent(
      "/profile",
    );
  });

  it("preserves ongoing action edit state when opening or closing the modal", async () => {
    const { user } = render(
      <DashboardShell header={<DashboardHeader />}>
        <div>
          <input data-testid="edit-input" defaultValue="Texto em edição" />
          <LocationTracker />
        </div>
      </DashboardShell>,
      {
        route: "/activity/action-123/edit",
        path: "*",
      },
    );

    const input = screen.getByTestId("edit-input");
    expect(input).toHaveValue("Texto em edição");

    const createButton = screen.getByRole("button", {
      name: /criar uma ação/i,
    });
    await user.click(createButton);
    expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: /cancelar/i });
    await user.click(closeButton);

    expect(screen.queryByText("Vamos criar uma ação?")).not.toBeInTheDocument();
    expect(input).toHaveValue("Texto em edição");
  });

  it("remains on /profile upon successful action creation from /profile", async () => {
    server.use(
      http.post("*/activities", () => {
        return HttpResponse.json({ id: "nova-acao-123" }, { status: 201 });
      }),
    );

    const { user } = render(<DummyPage title="Perfil" />, {
      route: "/profile",
      path: "*",
    });

    const createButton = screen.getByRole("button", {
      name: /criar uma ação/i,
    });
    await user.click(createButton);

    await fillStep1(user);
    await fillStep2(user);

    await user.click(screen.getByRole("button", { name: /Criar ação/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Sua ação foi registrada com sucesso!"),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /Visualizar no feed/i }),
    );

    expect(screen.getByTestId("current-pathname")).toHaveTextContent(
      "/profile",
    );
  });

  it("reloads feed without navigating when creating an action from /dashboard", async () => {
    let getActivitiesCount = 0;

    server.use(
      http.get("*/activities", () => {
        getActivitiesCount++;
        return HttpResponse.json({ content: [] });
      }),
      http.post("*/activities", () => {
        return HttpResponse.json({ id: "nova-acao-123" }, { status: 201 });
      }),
    );

    const { user } = render(<DashboardWithLocation />, {
      route: "/dashboard",
      path: "*",
    });

    const initialGetCount = getActivitiesCount;

    const createButton = screen.getByRole("button", {
      name: /criar uma ação/i,
    });
    await user.click(createButton);

    await fillStep1(user);
    await fillStep2(user);

    await user.click(screen.getByRole("button", { name: /Criar ação/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Sua ação foi registrada com sucesso!"),
      ).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /Visualizar no feed/i }),
    );

    await waitFor(() => {
      expect(getActivitiesCount).toBeGreaterThan(initialGetCount);
    });
    expect(screen.getByTestId("current-pathname")).toHaveTextContent(
      "/dashboard",
    );
  });

  it("triggers modal state from header without requiring custom onOpenRegister prop", async () => {
    const { user } = render(<DashboardHeader />, {
      route: "/profile",
      path: "*",
    });

    const createButton = screen.getByRole("button", {
      name: /criar uma ação/i,
    });
    await user.click(createButton);

    expect(useActionRegisterStore.getState().isOpen).toBe(true);
  });

  it("closes the register modal automatically when DashboardShell unmounts", () => {
    act(() => {
      useActionRegisterStore.setState({ isOpen: true });
    });

    const { unmount } = render(
      <DashboardShell header={<DashboardHeader />}>
        <div>Dashboard Content</div>
      </DashboardShell>,
      {
        route: "/dashboard",
        path: "*",
      },
    );

    expect(screen.getByText("Vamos criar uma ação?")).toBeInTheDocument();

    unmount();

    expect(screen.queryByText("Vamos criar uma ação?")).not.toBeInTheDocument();
  });
});
