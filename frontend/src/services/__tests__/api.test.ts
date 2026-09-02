import { afterEach, describe, expect, it, vi } from "vitest";
import { API, HttpResponse, http, server } from "@/test";
import { api } from "../api";
import { ApiError, NETWORK_ERROR_STATUS } from "../apiError";
import { setSessionExpiredHandler } from "../session";

const ENDPOINT = "/recurso";
const URL = `${API}${ENDPOINT}`;

/**
 * Captures the request MSW received, so the assertions can look at the method,
 * the headers and the body the client actually sent.
 */
function captureRequest(
  method: "get" | "post" | "patch" | "delete",
  response: () => Response,
) {
  const requests: Request[] = [];

  server.use(
    http[method](URL, ({ request }) => {
      requests.push(request.clone());
      return response();
    }),
  );

  return requests;
}

/** Runs `call` and returns the ApiError it rejected with. */
async function catchApiError(call: Promise<unknown>): Promise<ApiError> {
  try {
    await call;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }

  throw new Error("Expected the request to reject with an ApiError");
}

describe("api client", () => {
  describe("verbs", () => {
    it.each(["post", "patch"] as const)(
      "%s sends the JSON body, the content type and the session cookie",
      async (method) => {
        const requests = captureRequest(method, () =>
          HttpResponse.json({ ok: true }),
        );

        const result = await api[method]<{ ok: boolean }>(ENDPOINT, {
          title: "Ação",
        });

        expect(result).toEqual({ ok: true });
        expect(requests).toHaveLength(1);
        expect(requests[0].method).toBe(method.toUpperCase());
        expect(requests[0].headers.get("Content-Type")).toBe(
          "application/json",
        );
        expect(requests[0].credentials).toBe("include");
        await expect(requests[0].json()).resolves.toEqual({ title: "Ação" });
      },
    );

    it.each(["get", "delete"] as const)(
      "%s sends the session cookie and no body",
      async (method) => {
        const requests = captureRequest(method, () =>
          HttpResponse.json({ ok: true }),
        );

        await api[method]<{ ok: boolean }>(ENDPOINT);

        expect(requests[0].method).toBe(method.toUpperCase());
        expect(requests[0].credentials).toBe("include");
        expect(requests[0].body).toBeNull();
      },
    );
  });

  describe("empty responses", () => {
    it("resolves a 204 without trying to parse the body", async () => {
      server.use(
        http.delete(URL, () => new HttpResponse(null, { status: 204 })),
      );

      await expect(api.delete(ENDPOINT)).resolves.toBeUndefined();
    });

    // A 200 with an empty body would break `response.json()` just the same.
    it("resolves an empty 200 body without trying to parse it", async () => {
      server.use(http.post(URL, () => new HttpResponse("", { status: 200 })));

      await expect(api.post(ENDPOINT)).resolves.toBeUndefined();
    });
  });

  describe("error contract", () => {
    it("keeps the status, the message and the per-field errors of a 400", async () => {
      server.use(
        http.post(URL, () =>
          HttpResponse.json(
            {
              status: 400,
              message: "Validation error.",
              errors: [
                { field: "slots", message: "slots cannot exceed 10000." },
              ],
            },
            { status: 400 },
          ),
        ),
      );

      const error = await catchApiError(api.post(ENDPOINT, {}));

      expect(error.status).toBe(400);
      expect(error.message).toBe("Validation error.");
      expect(error.errors).toEqual([
        { field: "slots", message: "slots cannot exceed 10000." },
      ]);
    });

    it("falls back to the API message when a 400 carries no errors array", async () => {
      server.use(
        http.post(URL, () =>
          HttpResponse.json({ message: "Ação já encerrada" }, { status: 400 }),
        ),
      );

      const error = await catchApiError(api.post(ENDPOINT, {}));

      expect(error.message).toBe("Ação já encerrada");
      expect(error.errors).toEqual([]);
    });

    it("shows the communication failure on a 500 without leaking the raw body", async () => {
      server.use(
        http.get(URL, () =>
          HttpResponse.json(
            {
              message: "Internal server error.",
              stack: "at Object.<anonymous>",
            },
            { status: 500 },
          ),
        ),
      );

      const error = await catchApiError(api.get(ENDPOINT));

      expect(error.status).toBe(500);
      expect(error.message).toBe("Erro na comunicação com o servidor");
    });

    it("rejects with a pt-BR message when the request gets no response", async () => {
      server.use(http.get(URL, () => HttpResponse.error()));

      const error = await catchApiError(api.get(ENDPOINT));

      expect(error.status).toBe(NETWORK_ERROR_STATUS);
      expect(error.message).toBe("Erro na comunicação com o servidor");
    });
  });

  describe("session expiry", () => {
    let unsubscribe: (() => void) | null = null;

    afterEach(() => {
      unsubscribe?.();
      unsubscribe = null;
    });

    function onSessionExpired() {
      const handler = vi.fn();
      unsubscribe = setSessionExpiredHandler(handler);
      return handler;
    }

    it("notifies the session expired on a 401", async () => {
      const handler = onSessionExpired();
      server.use(http.get(URL, () => new HttpResponse(null, { status: 401 })));

      await catchApiError(api.get(ENDPOINT));

      expect(handler).toHaveBeenCalledOnce();
    });

    // The auth endpoints answer 401 for wrong credentials, which is the screen's
    // business, not an expired session.
    it("stays quiet on a 401 when the caller handles it", async () => {
      const handler = onSessionExpired();
      server.use(
        http.post(URL, () =>
          HttpResponse.json(
            { message: "Credenciais inválidas" },
            { status: 401 },
          ),
        ),
      );

      const error = await catchApiError(
        api.post(ENDPOINT, {}, { handleUnauthorized: false }),
      );

      expect(handler).not.toHaveBeenCalled();
      expect(error.message).toBe("Credenciais inválidas");
    });
  });
});
