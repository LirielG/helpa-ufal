import { describe, it, expect, beforeEach, vi } from "vitest";
import { API, server, http, HttpResponse } from "@/test";
import { makeLoginRequest, makeUser, signIn, signOut } from "@/test";
import { setSessionExpiredHandler } from "@/services/session";
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
      // Persisting it would let a reload trust the stored user unchecked.
      expect(persisted.state).not.toHaveProperty("isSessionVerified");
    });
  });

  describe("verifySession", () => {
    function countMeRequests(respond: () => Response) {
      const calls = { count: 0 };
      server.use(
        http.get(`${API}/users/me`, () => {
          calls.count += 1;
          return respond();
        }),
      );
      return calls;
    }

    it("replaces the stored user with the server's on success", async () => {
      const stored = signIn({ fullName: "Nome Antigo" });
      countMeRequests(() =>
        HttpResponse.json({
          ...stored,
          fullName: "Nome do Servidor",
          registrationCode: "2026000001",
          course: null,
          cndb: null,
        }),
      );

      await store().verifySession();

      expect(store().user).toEqual({
        id: stored.id,
        email: stored.email,
        fullName: "Nome do Servidor",
        userType: stored.userType,
        isManager: stored.isManager,
        createdAt: stored.createdAt,
      });
      expect(store().isSessionVerified).toBe(true);
    });

    // Same path as a 401 during use: the store does not clear anything itself.
    it("hands a 401 to the central session-expired handler", async () => {
      signIn();
      const onExpired = vi.fn();
      const unsubscribe = setSessionExpiredHandler(onExpired);
      countMeRequests(() => new HttpResponse(null, { status: 401 }));

      await store().verifySession();
      unsubscribe();

      expect(onExpired).toHaveBeenCalledOnce();
      expect(store().isSessionVerified).toBe(true);
    });

    it("drops the session through the central handler when the account is gone (404)", async () => {
      signIn();
      const onExpired = vi.fn();
      const unsubscribe = setSessionExpiredHandler(onExpired);
      countMeRequests(() => new HttpResponse(null, { status: 404 }));

      await store().verifySession();
      unsubscribe();

      expect(onExpired).toHaveBeenCalledOnce();
      expect(store().isSessionVerified).toBe(true);
    });

    it("keeps the user when the request gets no response", async () => {
      const user = signIn();
      countMeRequests(() => HttpResponse.error());

      await store().verifySession();

      expect(store().user).toEqual(user);
      expect(store().isSessionVerified).toBe(true);
    });

    it("skips the request when no user is stored", async () => {
      const calls = countMeRequests(() => HttpResponse.json(makeUser()));

      await store().verifySession();

      expect(calls.count).toBe(0);
      expect(store().isSessionVerified).toBe(true);
    });

    it("sends a single request for concurrent and repeated calls", async () => {
      const user = signIn();
      const calls = countMeRequests(() => HttpResponse.json(user));

      await Promise.all([store().verifySession(), store().verifySession()]);
      await store().verifySession();

      expect(calls.count).toBe(1);
    });

    it("does not bring back a user who logged out during the check", async () => {
      const user = signIn();
      countMeRequests(() => HttpResponse.json(user));

      const verification = store().verifySession();
      store().setUser(null);
      await verification;

      expect(store().user).toBeNull();
    });
  });

  it("marks the session verified on login", async () => {
    await store().login(makeLoginRequest());

    expect(store().isSessionVerified).toBe(true);
  });
});
