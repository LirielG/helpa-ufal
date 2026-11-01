import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import errorHandler from "@/controllers/error/ErrorHandler.js";
import { createRateLimiter } from "@/middlewares/rateLimit/createRateLimiter.js";

describe("rate limiting", () => {
  it("blocks the third request with the API error and retry time", async () => {
    const app = express();
    app.get(
      "/limited",
      createRateLimiter({ windowMs: 60_000, limit: 2, enabled: true }),
      (_req, res) => res.sendStatus(204),
    );
    app.use(errorHandler.defaultHandler.bind(errorHandler));

    await request(app).get("/limited").expect(204);
    await request(app).get("/limited").expect(204);
    const response = await request(app).get("/limited");

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      status: 429,
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests. Please try again later.",
    });
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(response.headers["retry-after"])).toBeLessThanOrEqual(60);
  });

  it("allows requests past the limit when disabled", async () => {
    const app = express();
    app.get(
      "/limited",
      createRateLimiter({ windowMs: 60_000, limit: 1, enabled: false }),
      (_req, res) => res.sendStatus(204),
    );

    for (let count = 0; count < 3; count++) {
      const response = await request(app).get("/limited");

      expect(response.status).toBe(204);
      expect(response.headers).not.toHaveProperty("ratelimit");
    }
  });

  it("keeps independent counters for each limiter and client IP", async () => {
    const app = express();
    app.set("trust proxy", 1);
    for (const path of ["/login", "/register", "/validate"]) {
      app.get(
        path,
        createRateLimiter({ windowMs: 60_000, limit: 1, enabled: true }),
        (_req, res) => res.sendStatus(204),
      );
    }
    app.use(errorHandler.defaultHandler.bind(errorHandler));

    await request(app)
      .get("/login")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(204);
    await request(app)
      .get("/login")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(429);
    await request(app)
      .get("/login")
      .set("X-Forwarded-For", "192.0.2.2")
      .expect(204);
    await request(app)
      .get("/register")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(204);
    await request(app)
      .get("/validate")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(204);
  });
});
