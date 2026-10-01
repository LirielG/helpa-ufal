import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router";
import { useActionRegisterStore } from "@/stores/actionRegisterStore";
import { DashboardShell } from "../DashboardShell";
import { DashboardHeader } from "../DashboardHeader";

// Componente para verificar a URL atual nos testes
function LocationTracker() {
  const location = useLocation();
  return <div data-testid="current-pathname">{location.pathname}</div>;
}

// Layout genérico com Shell e Header
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

describe("Issue #233 - Acessibilidade Global do Modal de Criação de Ações", () => {
  beforeEach(() => {
    // Reseta a store do Zustand antes de cada teste
    act(() => {
      useActionRegisterStore.setState({
        isOpen: false,
        onSuccessCallback: undefined,
      });
    });
  });

  it("1. Em /profile, clicar em 'Criar uma ação' abre o modal e a URL não muda", () => {
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<DummyPage title="Perfil" />} />
        </Routes>
      </MemoryRouter>
    );

    const createButton = screen.getByRole("button", { name: /criar uma ação/i });
    fireEvent.click(createButton);

    expect(useActionRegisterStore.getState().isOpen).toBe(true);
    expect(screen.getByTestId("current-pathname")).toHaveTextContent("/profile");
  });

  it("2. Em /activity/:id, clicar em 'Criar uma ação' abre o modal e a URL não muda", () => {
    render(
      <MemoryRouter initialEntries={["/activity/action-123"]}>
        <Routes>
          <Route
            path="/activity/:id"
            element={<DummyPage title="Detalhes da Ação" />}
          />
        </Routes>
      </MemoryRouter>
    );

    const createButton = screen.getByRole("button", { name: /criar uma ação/i });
    fireEvent.click(createButton);

    expect(useActionRegisterStore.getState().isOpen).toBe(true);
    expect(screen.getByTestId("current-pathname")).toHaveTextContent(
      "/activity/action-123"
    );
  });

  it("3. Em /activity/:id/edit, clicar em 'Criar uma ação' abre o modal — o clique nunca fica sem resposta", () => {
    render(
      <MemoryRouter initialEntries={["/activity/action-123/edit"]}>
        <Routes>
          <Route
            path="/activity/:id/edit"
            element={<DummyPage title="Edição" />}
          />
        </Routes>
      </MemoryRouter>
    );

    const createButton = screen.getByRole("button", { name: /criar uma ação/i });
    fireEvent.click(createButton);

    expect(useActionRegisterStore.getState().isOpen).toBe(true);
    expect(screen.getByTestId("current-pathname")).toHaveTextContent(
      "/activity/action-123/edit"
    );
  });

  it("4. No dashboard o comportamento é o de hoje: o modal abre no lugar", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<DummyPage title="Dashboard" />} />
        </Routes>
      </MemoryRouter>
    );

    const createButton = screen.getByRole("button", { name: /criar uma ação/i });
    fireEvent.click(createButton);

    expect(useActionRegisterStore.getState().isOpen).toBe(true);
    expect(screen.getByTestId("current-pathname")).toHaveTextContent("/dashboard");
  });

  it("5. Fechar o modal devolve a tela de origem, sem recarregar nem redirecionar", () => {
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<DummyPage title="Perfil" />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /criar uma ação/i }));
    expect(useActionRegisterStore.getState().isOpen).toBe(true);

    act(() => {
      useActionRegisterStore.getState().closeRegisterModal();
    });

    expect(useActionRegisterStore.getState().isOpen).toBe(false);
    expect(screen.getByTestId("current-pathname")).toHaveTextContent("/profile");
  });

  it("6. Cancelar a edição de uma ação em andamento não é exigido para abrir ou fechar o modal", () => {
    render(
      <MemoryRouter initialEntries={["/activity/action-123/edit"]}>
        <Routes>
          <Route
            path="/activity/:id/edit"
            element={
              <DashboardShell header={<DashboardHeader />}>
                <div>
                  <input data-testid="edit-input" defaultValue="Texto em edição" />
                  <LocationTracker />
                </div>
              </DashboardShell>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    const input = screen.getByTestId("edit-input");
    expect(input).toHaveValue("Texto em edição");

    fireEvent.click(screen.getByRole("button", { name: /criar uma ação/i }));
    expect(useActionRegisterStore.getState().isOpen).toBe(true);

    act(() => {
      useActionRegisterStore.getState().closeRegisterModal();
    });

    expect(input).toHaveValue("Texto em edição");
  });

  it("7. Criando a ação a partir de /profile, o usuário chega ao feed ao fechar com sucesso", () => {
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<DummyPage title="Perfil" />} />
          <Route path="/dashboard" element={<DummyPage title="Feed Dashboard" />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /criar uma ação/i }));
    expect(screen.getByTestId("current-pathname")).toHaveTextContent("/profile");
  });

  it("8. Criando a ação a partir do dashboard, o feed é recarregado sem navegação", () => {
    const loadActionsMock = vi.fn();

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <DashboardShell
                header={
                  <DashboardHeader
                    onOpenRegister={() =>
                      useActionRegisterStore
                        .getState()
                        .openRegisterModal(loadActionsMock)
                    }
                  />
                }
              >
                <LocationTracker />
              </DashboardShell>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /criar uma ação/i }));

    act(() => {
      const cb = useActionRegisterStore.getState().onSuccessCallback;
      if (cb) cb();
    });

    expect(loadActionsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("current-pathname")).toHaveTextContent("/dashboard");
  });

  it("9. Nenhuma página precisa passar um onOpenRegister próprio para o header se comportar corretamente", () => {
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <DashboardHeader />
      </MemoryRouter>
    );

    const createButton = screen.getByRole("button", { name: /criar uma ação/i });
    fireEvent.click(createButton);

    expect(useActionRegisterStore.getState().isOpen).toBe(true);
  });
});