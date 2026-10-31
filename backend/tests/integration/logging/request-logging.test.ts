import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { env } from "@/config/env.js";
import { createStudent, DEFAULT_PASSWORD } from "../../helpers/factories.js";

describe("Request logging middleware (integration)", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    env.NODE_ENV = "test";
    logSpy.mockClear();
    errorSpy.mockClear();
  });

  it("logs GET /activities?search=nome as 'GET /activities 200 <n>ms' without query string when NODE_ENV is not test", async () => {
    env.NODE_ENV = "development";

    const response = await request(app)
      .get("/activities")
      .query({ search: "nome" });

    expect(response.status).toBe(200);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = String(logSpy.mock.calls[0]?.[0]);
    expect(line).toMatch(/^GET \/activities 200 \d+ms$/);
    expect(line).not.toContain("search=nome");
  });

  it("never logs password, token, or cookie on POST /auth/login", async () => {
    env.NODE_ENV = "development";
    const email = "aluno-log-privacy@ufal.br";
    await createStudent({ email });

    const response = await request(app)
      .post("/auth/login")
      .set("Cookie", "token=existing-secret-cookie")
      .set("Authorization", "Bearer existing-secret-bearer")
      .send({ email, password: DEFAULT_PASSWORD });

    expect(response.status).toBe(200);
    const issuedToken: string = response.body.token;
    expect(issuedToken).toBeTruthy();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const allLogs = [
      ...logSpy.mock.calls.flat().map(String),
      ...errorSpy.mock.calls.flat().map(String),
    ].join("\n");

    expect(allLogs).toMatch(/^POST \/auth\/login 200 \d+ms$/);
    expect(allLogs).not.toContain(DEFAULT_PASSWORD);
    expect(allLogs).not.toContain(issuedToken);
    expect(allLogs).not.toContain("existing-secret-cookie");
    expect(allLogs).not.toContain("existing-secret-bearer");
    expect(allLogs).not.toContain("token=");
  });

  it("does not emit request log lines when NODE_ENV is test", async () => {
    expect(env.NODE_ENV).toBe("test");

    const response = await request(app)
      .get("/activities")
      .query({ search: "nome" });

    expect(response.status).toBe(200);
    expect(logSpy).not.toHaveBeenCalled();
  });
});
