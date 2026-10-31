import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

const envMock = vi.hoisted(() => ({ NODE_ENV: "development" as string }));
vi.mock("@/config/env.js", () => ({ env: envMock }));

import { requestLogger } from "../requestLogger.js";

function fakeReqRes(overrides: Partial<Request> = {}, statusCode = 200) {
  const req = {
    method: "GET",
    originalUrl: "/activities",
    headers: {},
    body: {},
    cookies: {},
    ...overrides,
  } as unknown as Request;

  const emitter = new EventEmitter();
  const res = Object.assign(emitter, { statusCode }) as unknown as Response;

  return { req, res, emitter };
}

describe("requestLogger", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  afterEach(() => {
    envMock.NODE_ENV = "development";
    logSpy.mockClear();
  });

  it("logs METHOD path status and duration in ms without query string on finish", () => {
    const { req, res, emitter } = fakeReqRes(
      { method: "GET", originalUrl: "/activities?search=nome&page=2" },
      200,
    );
    const next = vi.fn();

    requestLogger(req, res, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();

    emitter.emit("finish");

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = String(logSpy.mock.calls[0]?.[0]);
    expect(logged).toMatch(/^GET \/activities 200 \d+ms$/);
    expect(logged).not.toContain("search=nome");
  });

  it("writes nothing when NODE_ENV is test", () => {
    envMock.NODE_ENV = "test";
    const { req, res, emitter } = fakeReqRes();
    const next = vi.fn();

    requestLogger(req, res, next as unknown as NextFunction);
    emitter.emit("finish");

    expect(next).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("never logs body, cookies, or Authorization header", () => {
    const { req, res, emitter } = fakeReqRes(
      {
        method: "POST",
        originalUrl: "/auth/login?token=leak",
        headers: {
          authorization: "Bearer secret-jwt-token",
          cookie: "token=secret-cookie-token",
        },
        cookies: { token: "secret-cookie-token" },
        body: { email: "user@ufal.br", password: "SuperSecretPassword123!" },
      },
      200,
    );

    requestLogger(req, res, vi.fn() as unknown as NextFunction);
    emitter.emit("finish");

    const logged = String(logSpy.mock.calls[0]?.[0]);
    expect(logged).toMatch(/^POST \/auth\/login 200 \d+ms$/);
    expect(logged).not.toContain("SuperSecretPassword123!");
    expect(logged).not.toContain("secret-jwt-token");
    expect(logged).not.toContain("secret-cookie-token");
    expect(logged).not.toContain("leak");
  });
});
