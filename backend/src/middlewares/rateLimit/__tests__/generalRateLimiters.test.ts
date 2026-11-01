import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import errorHandler from "@/controllers/error/ErrorHandler.js";
import { createGeneralRateLimiters } from "@/middlewares/rateLimit/generalRateLimiters.js";
import { signJwt } from "@/utils/jwt.js";

const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

function tokenFor(id = USER_ID, expiresIn?: string) {
  return signJwt(
    { id, userType: "STUDENT", isManager: false, tokenVersion: 0 },
    expiresIn,
  );
}

function clientApp(
  options: Parameters<typeof createGeneralRateLimiters>[0] = {},
) {
  const app = express();
  app.set("trust proxy", 1);
  const { globalRateLimiter, clientRateLimiter } = createGeneralRateLimiters({
    enabled: true,
    ...options,
  });
  app.use(globalRateLimiter);
  app.use(cookieParser());
  app.use(clientRateLimiter);
  app.use((_req, res) => res.sendStatus(204));
  app.use(errorHandler.defaultHandler.bind(errorHandler));
  return app;
}

describe("general rate limits", () => {
  it("shares the instance quota across routes and client IPs", async () => {
    const app = express();
    app.set("trust proxy", 1);
    const { globalRateLimiter } = createGeneralRateLimiters({
      globalLimit: 2,
      enabled: true,
    });
    app.use(globalRateLimiter);
    app.use((_req, res) => res.sendStatus(204));
    app.use(errorHandler.defaultHandler.bind(errorHandler));

    await request(app)
      .get("/first")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(204);
    await request(app)
      .get("/second")
      .set("X-Forwarded-For", "192.0.2.2")
      .expect(204);
    const response = await request(app)
      .get("/third")
      .set("X-Forwarded-For", "192.0.2.3");

    expect(response.status).toBe(429);
    expect(response.body.code).toBe("TOO_MANY_REQUESTS");
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(response.headers["retry-after"])).toBeLessThanOrEqual(60);
  });

  it("shares the anonymous IP quota across routes and keeps other IPs independent", async () => {
    const app = clientApp({ anonymousLimit: 2 });

    await request(app)
      .get("/first")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(204);
    await request(app)
      .post("/second")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(204);
    await request(app)
      .get("/third")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(429);
    await request(app)
      .get("/third")
      .set("X-Forwarded-For", "192.0.2.2")
      .expect(204);
  });

  it("keeps a user quota across IPs and independently of other users on the same IP", async () => {
    const app = clientApp({ anonymousLimit: 1, authenticatedLimit: 2 });
    const token = tokenFor();
    const anotherToken = tokenFor("9c9e6679-7425-40de-944b-e07fc1f90ae7");

    await request(app)
      .get("/first")
      .set("Cookie", `token=${token}`)
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(204);
    await request(app)
      .post("/second")
      .set("Cookie", `token=${token}`)
      .set("X-Forwarded-For", "192.0.2.2")
      .expect(204);
    await request(app)
      .get("/third")
      .set("Cookie", `token=${token}`)
      .set("X-Forwarded-For", "192.0.2.3")
      .expect(429);
    await request(app)
      .get("/third")
      .set("Cookie", `token=${anotherToken}`)
      .set("X-Forwarded-For", "192.0.2.3")
      .expect(204);
    await request(app)
      .get("/third")
      .set("X-Forwarded-For", "192.0.2.3")
      .expect(204);
  });

  it.each([
    ["malformed", () => "not-a-token"],
    ["expired", () => tokenFor(USER_ID, "-1s")],
    ["invalid signature", () => jwt.sign({ id: USER_ID }, "wrong-secret")],
    ["missing user id", () => tokenFor("")],
  ])(
    "uses the anonymous IP quota for a token with %s",
    async (_name, makeToken) => {
      const app = clientApp({ anonymousLimit: 1, authenticatedLimit: 3 });

      await request(app)
        .get("/first")
        .set("Cookie", `token=${makeToken()}`)
        .expect(204);
      await request(app).get("/second").expect(429);
    },
  );

  it("keeps the same user quota when the token changes", async () => {
    const app = clientApp({ authenticatedLimit: 1 });
    const oldToken = tokenFor();
    const newToken = signJwt({
      id: USER_ID,
      userType: "STUDENT",
      isManager: false,
      tokenVersion: 1,
    });

    await request(app)
      .get("/first")
      .set("Cookie", `token=${oldToken}`)
      .expect(204);
    await request(app)
      .get("/second")
      .set("Cookie", `token=${newToken}`)
      .expect(429);
  });

  it("normalizes anonymous IPv6 addresses to prevent address rotation from renewing the quota", async () => {
    const app = clientApp({ anonymousLimit: 1 });

    await request(app)
      .get("/first")
      .set("X-Forwarded-For", "2001:db8:1234:5600::1")
      .expect(204);
    await request(app)
      .get("/second")
      .set("X-Forwarded-For", "2001:db8:1234:5600::2")
      .expect(429);
    await request(app)
      .get("/third")
      .set("X-Forwarded-For", "2001:db8:1234:5700::1")
      .expect(204);
  });

  it("disables both general quotas and omits their headers", async () => {
    const app = clientApp({
      anonymousLimit: 1,
      authenticatedLimit: 1,
      globalLimit: 1,
      enabled: false,
    });

    for (let count = 0; count < 3; count++) {
      const response = await request(app).get("/first");
      expect(response.status).toBe(204);
      expect(response.headers).not.toHaveProperty("ratelimit");
    }
  });

  it("preserves the policy headers of both general quotas", async () => {
    const app = clientApp();

    const response = await request(app).get("/first");

    expect(response.headers["ratelimit"]).toContain('"global"');
    expect(response.headers["ratelimit"]).toContain('"client"');
    expect(response.headers["ratelimit-policy"]).toContain('"global"');
    expect(response.headers["ratelimit-policy"]).toContain('"client"');
  });

  it("does not consume quotas for OPTIONS requests", async () => {
    const app = clientApp({ anonymousLimit: 1, globalLimit: 1 });

    await request(app).options("/first").expect(204);
    await request(app).options("/first").expect(204);
    await request(app).get("/first").expect(204);
    await request(app).get("/first").expect(429);
  });
});
