import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  screen,
  act,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { useLocation } from "react-router";
import { render, http, HttpResponse, server } from "@/test";
import { useActionRegisterStore } from "@/stores/actionRegisterStore";
import { DashboardShell } from "../DashboardShell";
import { DashboardHeader } from "../DashboardHeader";
import { Dashboard } from "@/pages/Dashboard";

vi.mock("@/features/dashboard/components/HeroBanner", () => ({
  HeroBanner: () => <div data-testid="hero-banner">Hero Banner</div>,
}));

function LocationTracker() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-pathname">{location.pathname}</div>
      {/* The key changes on every navigation, even to the same path. */}
      <div data-testid="current-location-key">{location.key}</div>
    </>
  );
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
      <Dashboard debounceMs={0} />
      <LocationTracker />
    </>
  );
}

// The Dashboard has filters labelled like the form fields, so queries are
// scoped to the modal.
function registerDialog() {
  return within(screen.getByRole("dialog", { name: "Criar uma ação" }));
}

async function fillStep1(user: UserEvent) {
  await user.type(
    registerDialog().getByPlaceholderText("Digite o título da sua ação"),
    "Mutirão de Saúde",
  );
  await user.selectOptions(
    registerDialog().getByLabelText(/Área de atuação/i),
    "Educação",
  );
  await user.selectOptions(
    registerDialog().getByLabelText(/Tipo da ação/i),
    "EXTENSION",
  );

  await user.click(registerDialog().getByRole("button", { name: /Próximo/i }));

  await waitFor(() => {
    expect(
      registerDialog().getByRole("heading", {
        name: "Conte-nos onde e quando será",
      }),
    ).toBeInTheDocument();
  });
}

async function fillStep2(user: UserEvent) {
  await user.selectOptions(
    registerDialog().getByLabelText(/^Campus/i),
    "ARAPIRACA",
  );
  await user.selectOptions(
    registerDialog().getByLabelText(/Formato da ação/i),
    "ONLINE",
  );
  await user.type(registerDialog().getByLabelText(/Carga horária total/i), "4");
  await user.type(registerDialog().getByLabelText(/Número de vagas/i), "50");

  await user.type(
    registerDialog().getByPlaceholderText(/Ex: https:\/\/meet.google.com/i),
    "https://meet.google.com/abc",
  );

  fireEvent.change(
    registerDialog().getByLabelText(/Início/i, {
      selector: 'input[type="date"]',
    }),
    {
      target: { value: "2026-10-10" },
    },
  );
  fireEvent.change(
    registerDialog().getByLabelText(/Fim/i, { selector: 'input[type="date"]' }),
    {
      target: { value: "2026-10-10" },
    },
  );
}

describe("DashboardShell", () => {
  beforeEach(() => {
    server.use(
      http.get("*/activities", () => {
        return HttpResponse.json({ activities: [], total: 0 });
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

  it("takes the user to the feed after creating an action from /profile", async () => {
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
      "/dashboard",
    );
  });

  it("reloads feed without navigating when creating an action from /dashboard", async () => {
    let getActivitiesCount = 0;

    server.use(
      http.get("*/activities", () => {
        getActivitiesCount++;
        return HttpResponse.json({ activities: [], total: 0 });
      }),
      http.post("*/activities", () => {
        return HttpResponse.json({ id: "nova-acao-123" }, { status: 201 });
      }),
    );

    const { user } = render(<DashboardWithLocation />, {
      route: "/dashboard",
      path: "*",
    });

    await waitFor(() => expect(getActivitiesCount).toBe(1));
    const locationKey = screen.getByTestId("current-location-key").textContent;

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
    await waitFor(() => expect(getActivitiesCount).toBe(2));

    await user.click(
      screen.getByRole("button", { name: /Visualizar no feed/i }),
    );

    expect(screen.queryByText("Vamos criar uma ação?")).not.toBeInTheDocument();
    expect(screen.getByTestId("current-location-key")).toHaveTextContent(
      locationKey!,
    );
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
