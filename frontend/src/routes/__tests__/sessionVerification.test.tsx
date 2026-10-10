import { StrictMode } from "react";
import { useNavigate } from "react-router";
import { describe, expect, it } from "vitest";
import {
  API,
  HttpResponse,
  http,
  makeUser,
  render,
  screen,
  server,
  waitFor,
} from "@/test";
import { useAuthStore } from "@/stores/authStore";
import type { UserProfile, User } from "@/types";
import { AppRoutes } from "../AppRoutes";

const STORAGE_KEY = "helpa-auth";

/**
 * Simulates a page reload with a user left in localStorage by an earlier
 * session: the persisted copy is rehydrated into a fresh, unverified store.
 */
async function reloadWithStoredUser(overrides: Partial<User> = {}) {
  const user = makeUser(overrides);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: { user }, version: 0 }),
  );
  await useAuthStore.persist.rehydrate();
  return user;
}

function persistedUser(): User | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw).state.user : null;
}

function meResponse(user: User, overrides: Partial<UserProfile> = {}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    userType: user.userType,
    isManager: user.isManager,
    createdAt: user.createdAt,
    registrationCode: "2026000001",
    course: "Ciência da Computação",
    cndb: null,
    ...overrides,
  };
}

/**
 * Holds `GET /users/me` until `respond` is called, so a test can look at the
 * screen while the check is in flight. Every request gets its own response
 * (Profile asks for `/users/me` too, and a body can only be read once).
 */
function holdSessionCheck() {
  let release: (makeResponse: () => Response) => void = () => {};
  const gate = new Promise<() => Response>((resolve) => {
    release = resolve;
  });

  server.use(
    http.get(`${API}/users/me`, async () => (await gate)()),
  );

  return { respond: (makeResponse: () => Response) => release(makeResponse) };
}

function countSessionChecks(respond: () => Response) {
  const calls = { count: 0 };

  server.use(
    http.get(`${API}/users/me`, () => {
      calls.count += 1;
      return respond();
    }),
  );

  return calls;
}

const unauthorized = () => new HttpResponse(null, { status: 401 });

function queryLoginForm() {
  return screen.queryByRole("button", { name: "Entrar" });
}

function querySessionLoader() {
  return screen.queryByRole("status");
}

describe("session verification on load", () => {
  // Criterion 1
  it("keeps a valid session signed in across a reload, never showing the login screen", async () => {
    const user = await reloadWithStoredUser();
    const check = holdSessionCheck();

    render(<AppRoutes />, { route: "/profile" });

    expect(querySessionLoader()).toBeInTheDocument();
    expect(queryLoginForm()).toBeNull();

    check.respond(() => HttpResponse.json(meResponse(user)));

    expect(await screen.findByText("Dados Pessoais")).toBeInTheDocument();
    expect(queryLoginForm()).toBeNull();
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  // Criterion 2
  it("sends the user to login and clears localStorage when the cookie is gone", async () => {
    await reloadWithStoredUser();
    countSessionChecks(unauthorized);

    render(<AppRoutes />, { route: "/dashboard" });

    expect(await screen.findByRole("button", { name: "Entrar" })).toBeVisible();
    expect(useAuthStore.getState().user).toBeNull();
    expect(persistedUser()).toBeNull();
  });

  it("sends the user to login when the token is valid but the account is gone (404)", async () => {
    await reloadWithStoredUser();
    countSessionChecks(() => new HttpResponse(null, { status: 404 }));

    render(<AppRoutes />, { route: "/dashboard" });

    expect(await screen.findByRole("button", { name: "Entrar" })).toBeVisible();
    expect(useAuthStore.getState().user).toBeNull();
    expect(persistedUser()).toBeNull();
  });

  // Criterion 3
  it("takes a protected URL opened with an invalid session to login, not to the screen", async () => {
    await reloadWithStoredUser();
    countSessionChecks(unauthorized);

    render(<AppRoutes />, { route: "/profile" });

    expect(await screen.findByRole("button", { name: "Entrar" })).toBeVisible();
    // Profile paints "Carregando..." on mount and "Dados Pessoais" once loaded:
    // neither means the screen never mounted.
    expect(screen.queryByText("Carregando...")).toBeNull();
    expect(screen.queryByText("Dados Pessoais")).toBeNull();
  });

  // Criterion 4
  it("shows only the loader while the check is in flight", async () => {
    const user = await reloadWithStoredUser();
    const check = holdSessionCheck();

    render(<AppRoutes />, { route: "/profile" });

    expect(querySessionLoader()).toHaveTextContent("Verificando sessão...");
    expect(queryLoginForm()).toBeNull();
    expect(screen.queryByText("Carregando...")).toBeNull();
    expect(screen.queryByText("Dados Pessoais")).toBeNull();

    check.respond(() => HttpResponse.json(meResponse(user)));

    await waitFor(() => expect(querySessionLoader()).toBeNull());
  });

  // Criterion 5
  it("keeps the user signed in and localStorage intact when the server cannot be reached", async () => {
    const user = await reloadWithStoredUser();
    countSessionChecks(() => HttpResponse.error());

    render(<AppRoutes />, { route: "/profile" });

    await waitFor(() =>
      expect(useAuthStore.getState().isSessionVerified).toBe(true),
    );
    expect(queryLoginForm()).toBeNull();
    expect(useAuthStore.getState().user).toEqual(user);
    expect(persistedUser()).toEqual(user);
  });

  it("treats a server error like a network failure and keeps the user", async () => {
    const user = await reloadWithStoredUser();
    countSessionChecks(() => new HttpResponse(null, { status: 500 }));

    render(<AppRoutes />, { route: "/dashboard" });

    await waitFor(() =>
      expect(useAuthStore.getState().isSessionVerified).toBe(true),
    );
    expect(queryLoginForm()).toBeNull();
    expect(persistedUser()).toEqual(user);
  });

  // Criterion 6
  it("shows the user data from the server response, not from localStorage", async () => {
    const user = await reloadWithStoredUser({ fullName: "Nome Antigo" });
    countSessionChecks(() =>
      HttpResponse.json(
        meResponse(user, { fullName: "Servidor Atual", isManager: true }),
      ),
    );

    render(<AppRoutes />, { route: "/dashboard" });

    expect(
      await screen.findByRole("button", { name: "Abrir perfil" }),
    ).toHaveTextContent("Servidor");

    expect(useAuthStore.getState().user).toEqual({
      id: user.id,
      email: user.email,
      fullName: "Servidor Atual",
      userType: user.userType,
      isManager: true,
      createdAt: user.createdAt,
    });
    // Only the fields `User` describes are kept, and persisted.
    expect(persistedUser()).toEqual(useAuthStore.getState().user);
  });

  // Criterion 7
  it("keeps GuestRoute from redirecting to the dashboard until the check ends", async () => {
    await reloadWithStoredUser();
    const check = holdSessionCheck();

    render(<AppRoutes />, { route: "/login" });

    expect(querySessionLoader()).toBeInTheDocument();
    expect(queryLoginForm()).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Disponibilidade" })).toBeNull();

    check.respond(unauthorized);

    expect(await screen.findByRole("button", { name: "Entrar" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Disponibilidade" })).toBeNull();
  });

  // Criterion 8
  it("checks once per load, not on every navigation", async () => {
    const user = await reloadWithStoredUser();
    const calls = countSessionChecks(() =>
      HttpResponse.json(meResponse(user)),
    );

    function Navigator() {
      const navigate = useNavigate();
      return (
        <>
          <button onClick={() => navigate("/activity/1")}>detalhe</button>
          <button onClick={() => navigate("/dashboard")}>painel</button>
        </>
      );
    }

    // StrictMode double-runs effects: the check still goes out once.
    const { user: ui } = render(
      <StrictMode>
        <AppRoutes />
        <Navigator />
      </StrictMode>,
      { route: "/dashboard" },
    );

    await waitFor(() =>
      expect(useAuthStore.getState().isSessionVerified).toBe(true),
    );

    await ui.click(screen.getByRole("button", { name: "detalhe" }));
    await screen.findByText("Oficina de Programação");
    await ui.click(screen.getByRole("button", { name: "painel" }));
    await screen.findByRole("combobox", { name: "Disponibilidade" });

    expect(calls.count).toBe(1);
  });

  it("does not ask the server when nothing is stored", async () => {
    const calls = countSessionChecks(unauthorized);

    render(<AppRoutes />, { route: "/dashboard" });

    expect(
      await screen.findByRole("combobox", { name: "Disponibilidade" }),
    ).toBeInTheDocument();
    expect(calls.count).toBe(0);
    expect(useAuthStore.getState().isSessionVerified).toBe(true);
  });
});
