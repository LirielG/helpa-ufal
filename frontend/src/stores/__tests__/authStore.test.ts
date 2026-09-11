import { describe, it, expect, beforeEach } from "vitest";
import { API, server, http, HttpResponse } from "@/test";
import { makeLoginRequest, makeUser, signIn, signOut } from "@/test";
import { useAuthStore } from "@/stores/authStore";

function store() {
  return useAuthStore.getState();
}

describe("authStore", () => {
  beforeEach(() => {
    signOut();
  });

  describe("login", () => {
    it("stores the user from the response and returns true on success", async () => {
      const user = makeUser();
      server.use(
        http.post(`${API}/auth/login`, () =>
          HttpResponse.json({ token: "test-token", user }),
        ),
      );

      const result = await store().login(makeLoginRequest());

      expect(result).toBe(true);
      expect(store().user).toEqual(user);
      expect(store().error).toBeNull();
      expect(store().isLoading).toBe(false);
    });

    it("returns false, keeps user null and stores the API message on failure", async () => {
      server.use(
        http.post(`${API}/auth/login`, () =>
          HttpResponse.json(
            { message: "Credenciais inválidas" },
            { status: 401 },
          ),
        ),
      );

      const result = await store().login(makeLoginRequest());

      expect(result).toBe(false);
      expect(store().user).toBeNull();
      expect(store().error).toBe("Credenciais inválidas");
      expect(store().isLoading).toBe(false);
    });
  });

  describe("clearError", () => {
    it("clears the error without touching the user", async () => {
      server.use(
        http.post(`${API}/auth/login`, () =>
          HttpResponse.json({ message: "Erro de teste" }, { status: 400 }),
        ),
      );
      await store().login(makeLoginRequest());

      store().clearError();

      expect(store().error).toBeNull();
      expect(store().user).toBeNull();
    });
  });

  describe("logout", () => {
    it("calls POST /auth/logout and clears the user on success", async () => {
      signIn();
      let logoutCalled = false;
      server.use(
        http.post(`${API}/auth/logout`, () => {
          logoutCalled = true;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      await store().logout();

      expect(logoutCalled).toBe(true);
      expect(store().user).toBeNull();
      expect(store().isLoading).toBe(false);
    });

    // Fails open, and silently: an error left in the store would render on the
    // login screen the visitor is sent to right after.
    it("clears the user without surfacing an error when the API fails", async () => {
      signIn();
      server.use(
        http.post(`${API}/auth/logout`, () =>
          HttpResponse.json({ message: "Erro ao sair" }, { status: 400 }),
        ),
      );

      await store().logout();

      expect(store().user).toBeNull();
      expect(store().error).toBeNull();
      expect(store().isLoading).toBe(false);
    });
  });

  describe("persistence", () => {
    it("persists only the user under the helpa-auth key", async () => {
      const user = signIn();

      const raw = localStorage.getItem("helpa-auth");
      expect(raw).not.toBeNull();

      const persisted = JSON.parse(raw!);
      expect(persisted.state.user).toEqual(user);
      expect(persisted.state).not.toHaveProperty("error");
      expect(persisted.state).not.toHaveProperty("isLoading");
    });
  });
});
