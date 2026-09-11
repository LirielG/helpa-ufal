import { describe, expect, it, vi } from "vitest";
import { API, http, HttpResponse, server } from "@/test";
import { makeLoginRequest, makeRegisterRequest } from "@/test";
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
      const requests = captureRequest("/auth/login", () =>
        HttpResponse.json({ token: "test-token", user: makeLoginRequest() }),
      );

      await authService.login(makeLoginRequest());

      expect(requests).toHaveLength(1);
      expect(requests[0].method).toBe("POST");
      expect(requests[0].url).toBe(`${API}/auth/login`);
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
  });

  describe("handleUnauthorized", () => {
    it.each([
      ["/auth/login", () => authService.login(makeLoginRequest())],
      ["/auth/register", () => authService.register(makeRegisterRequest())],
      ["/auth/logout", () => authService.logout()],
    ] as const)(
      "a 401 on %s does not trigger the session-expired handler",
      async (endpoint, call) => {
        const handler = vi.fn();
        const unsubscribe = setSessionExpiredHandler(handler);

        try {
          server.use(
            http.post(`${API}${endpoint}`, () =>
              new HttpResponse(null, { status: 401 }),
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