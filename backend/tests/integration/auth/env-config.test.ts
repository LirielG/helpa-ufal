import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { ZodError } from "zod";
import { createStudent, DEFAULT_PASSWORD } from "../../helpers/factories.js";


const CUSTOM_ORIGIN = "https://helpa.ufal.br";
const DEFAULT_ORIGIN = "http://localhost:5173";
const LOGIN_URL = "/auth/login";


async function importFreshApp() {
  vi.resetModules();
  return (await import("@/app.js")).app;
}


afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});


describe("CORS_ORIGIN (critério 2)", () => {
  it("answers the preflight with the configured origin and credentials", async () => {
    vi.stubEnv("CORS_ORIGIN", CUSTOM_ORIGIN);
    const app = await importFreshApp();


    const response = await request(app)
      .options(LOGIN_URL)
      .set("Origin", CUSTOM_ORIGIN)
      .set("Access-Control-Request-Method", "POST");


    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(CUSTOM_ORIGIN);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });


  it("no longer names the default origin once another is configured", async () => {
    vi.stubEnv("CORS_ORIGIN", CUSTOM_ORIGIN);
    const app = await importFreshApp();


    const response = await request(app)
      .options(LOGIN_URL)
      .set("Origin", DEFAULT_ORIGIN)
      .set("Access-Control-Request-Method", "POST");

    expect(response.headers["access-control-allow-origin"]).toBe(CUSTOM_ORIGIN);
    expect(response.headers["access-control-allow-origin"]).not.toBe(
      DEFAULT_ORIGIN,
    );
  });


  it("keeps serving the default origin when the variable is unset (critério 1)", async () => {
    const app = await importFreshApp();


    const response = await request(app)
      .options(LOGIN_URL)
      .set("Origin", DEFAULT_ORIGIN)
      .set("Access-Control-Request-Method", "POST");


    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(DEFAULT_ORIGIN);
  });
});


describe("COOKIE_SAME_SITE (critério 3)", () => {
  it("emits SameSite=Lax on the login Set-Cookie when configured", async () => {
    vi.stubEnv("COOKIE_SAME_SITE", "lax");
    const app = await importFreshApp();


    const email = "aluno-samesite@ufal.br";
    await createStudent({ email });


    const response = await request(app)
      .post(LOGIN_URL)
      .send({ email, password: DEFAULT_PASSWORD });


    expect(response.status).toBe(200);
    const setCookie = response.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const [sessionCookie] = Array.isArray(setCookie) ? setCookie : [setCookie];
    expect(sessionCookie).toMatch(/^token=/);
    expect(sessionCookie).toMatch(/SameSite=Lax/);
    expect(sessionCookie).toMatch(/Max-Age=\d+/);
  });
});


describe("invalid config at boot (critério 6)", () => {
  it("rejects the app import with a ZodError when COOKIE_SAME_SITE is invalid", async () => {
    vi.stubEnv("COOKIE_SAME_SITE", "sometimes");


    await expect(importFreshApp()).rejects.toThrow(ZodError);
  });
});
