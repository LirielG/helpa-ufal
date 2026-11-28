import { describe, expect, it, vi } from "vitest";
import { API, http, HttpResponse, server } from "@/test";
import { makeLoginRequest, makeRegisterRequest, makeUser } from "@/test";
import { authService } from "../auth";
import { setSessionExpiredHandler } from "../session";

function captureRequest(endpoint: string, response: () => Response) {
  const requests: Request[] = [];

  server.use(
    http.post(`${API}${endpoint}`, ({ request }) => {
      requests.push(request.clone());
      return response();
    }),
  );

  return requests;
}

describe("authService", () => {
  describe("endpoints", () => {
    it("login hits POST /auth/login", async () => {
      const user = makeUser();
      const requests = captureRequest("/auth/login", () =>
        HttpResponse.json({ user }),
      );

      const response = await authService.login(makeLoginRequest());

      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe("POST");
      expect(requests[0].url).toBe(`${API}/auth/login`);
      expect(response).toEqual({ user });
    });

    it("register hits POST /auth/register", async () => {
      const requests = captureRequest("/auth/register", () =>
        HttpResponse.json({}, { status: 201 }),
      );

      await authService.register(makeRegisterRequest());

      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe("POST");
      expect(requests[0].url).toBe(`${API}/auth/register`);
    });

    it("logout hits POST /auth/logout", async () => {
      const requests = captureRequest(
        "/auth/logout",
        () => new HttpResponse(null, { status: 204 }),
      );

      await authService.logout();

      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe("POST");
      expect(requests[0].url).toBe(`${API}/auth/logout`);
    });

    it("requestPasswordReset hits POST /auth/forgot-password with the e-mail", async () => {
      const requests = captureRequest(
        "/auth/forgot-password",
        () => new HttpResponse(null, { status: 204 }),
      );

      await authService.requestPasswordReset({ email: "ana@ufal.br" });

      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe("POST");
      expect(requests[0].url).toBe(`${API}/auth/forgot-password`);
      expect(await requests[0].json()).toEqual({ email: "ana@ufal.br" });
    });

    it("verifyPasswordResetCode hits POST /auth/forgot-password/verify with e-mail and code", async () => {
      const requests = captureRequest(
        "/auth/forgot-password/verify",
        () => new HttpResponse(null, { status: 204 }),
      );

      await authService.verifyPasswordResetCode({
        email: "ana@ufal.br",
        code: "7KQ4-MX9T",
      });

      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe("POST");
      expect(requests[0].url).toBe(`${API}/auth/forgot-password/verify`);
      expect(await requests[0].json()).toEqual({
        email: "ana@ufal.br",
        code: "7KQ4-MX9T",
      });
    });

    it("resetPassword hits POST /auth/reset-password with e-mail, code and newPassword", async () => {
      const requests = captureRequest(
        "/auth/reset-password",
        () => new HttpResponse(null, { status: 204 }),
      );

      await authService.resetPassword({
        email: "ana@ufal.br",
        code: "7KQ4-MX9T",
        newPassword: "Nova@Senha1",
      });

      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe("POST");
      expect(requests[0].url).toBe(`${API}/auth/reset-password`);
      expect(await requests[0].json()).toEqual({
        email: "ana@ufal.br",
        code: "7KQ4-MX9T",
        newPassword: "Nova@Senha1",
      });
    });
  });

  describe("handleUnauthorized", () => {
    it.each([
      ["/auth/login", () => authService.login(makeLoginRequest())],
      ["/auth/register", () => authService.register(makeRegisterRequest())],
      ["/auth/logout", () => authService.logout()],
      [
        "/auth/forgot-password",
        () => authService.requestPasswordReset({ email: "ana@ufal.br" }),
      ],
      [
        "/auth/forgot-password/verify",
        () =>
          authService.verifyPasswordResetCode({
            email: "ana@ufal.br",
            code: "7KQ4-MX9T",
          }),
      ],
      [
        "/auth/reset-password",
        () =>
          authService.resetPassword({
            email: "ana@ufal.br",
            code: "7KQ4-MX9T",
            newPassword: "Nova@Senha1",
          }),
      ],
    ] as const)(
      "a 401 on %s does not trigger the session-expired handler",
      async (endpoint, call) => {
        const handler = vi.fn();
        const unsubscribe = setSessionExpiredHandler(handler);

        try {
          server.use(
            http.post(
              `${API}${endpoint}`,
              () => new HttpResponse(null, { status: 401 }),
            ),
          );

          await expect(call()).rejects.toThrow();
        } finally {
          unsubscribe();
        }

        expect(handler).not.toHaveBeenCalled();
      },
    );
  });
});
