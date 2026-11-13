import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createStudent } from "../../helpers/factories.js";
import { prisma } from "@/database/prisma.js";

async function importApp(overrides: Record<string, string> = {}) {
  for (const [name, value] of Object.entries({
    RATE_LIMIT_ENABLED: "true",
    TRUST_PROXY: "1",
    RATE_LIMIT_ANONYMOUS_PER_MINUTE: "100",
    RATE_LIMIT_AUTHENTICATED_PER_MINUTE: "100",
    RATE_LIMIT_GLOBAL_PER_MINUTE: "100",
    ...overrides,
  })) {
    vi.stubEnv(name, value);
  }
  vi.resetModules();
  return (await import("@/app.js")).app;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("general API rate limits", () => {
  it("applies the instance quota across routes and different client IPs", async () => {
    const app = await importApp({ RATE_LIMIT_GLOBAL_PER_MINUTE: "2" });

    await request(app)
      .post("/auth/logout")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(204);
    await request(app)
      .get("/certificate-validations/invalid")
      .set("X-Forwarded-For", "192.0.2.2")
      .expect(404);
    const response = await request(app)
      .get("/unknown-route")
      .set("X-Forwarded-For", "192.0.2.3");

    expect(response.status).toBe(429);
    expect(response.body.code).toBe("TOO_MANY_REQUESTS");
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(response.headers["retry-after"])).toBeLessThanOrEqual(60);
  });

  it("shares the anonymous quota across public routes without blocking another IP", async () => {
    const app = await importApp({ RATE_LIMIT_ANONYMOUS_PER_MINUTE: "2" });

    await request(app)
      .get("/activities/filters")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(200);
    await request(app)
      .post("/auth/logout")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(204);
    await request(app)
      .get("/activities")
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(429);
    await request(app)
      .get("/activities")
      .set("X-Forwarded-For", "192.0.2.2")
      .expect(200);
  });

  it("shares the user quota across protected routes and IPs without blocking other identities", async () => {
    const first = await createStudent();
    const second = await createStudent();
    const app = await importApp({
      RATE_LIMIT_ANONYMOUS_PER_MINUTE: "1",
      RATE_LIMIT_AUTHENTICATED_PER_MINUTE: "2",
    });

    await request(app)
      .get("/users/me")
      .set("Cookie", `token=${first.token}`)
      .set("X-Forwarded-For", "192.0.2.1")
      .expect(200);
    await request(app)
      .get("/users/me/activities?filter=enrolled")
      .set("Cookie", `token=${first.token}`)
      .set("X-Forwarded-For", "192.0.2.2")
      .expect(200);
    await request(app)
      .get("/users/me")
      .set("Cookie", `token=${first.token}`)
      .set("X-Forwarded-For", "192.0.2.3")
      .expect(429);
    await request(app)
      .get("/users/me")
      .set("Cookie", `token=${second.token}`)
      .set("X-Forwarded-For", "192.0.2.3")
      .expect(200);
    await request(app)
      .get("/activities")
      .set("X-Forwarded-For", "192.0.2.3")
      .expect(200);
  });

  it("counts failed protected requests against the anonymous quota", async () => {
    const app = await importApp({ RATE_LIMIT_ANONYMOUS_PER_MINUTE: "1" });

    await request(app)
      .get("/users/me")
      .set("Cookie", "token=invalid-one")
      .expect(401);
    await request(app)
      .get("/users/me")
      .set("Cookie", "token=invalid-two")
      .expect(429);
  });

  it("keeps revoked sessions unauthorized despite recognizing the signed quota identity", async () => {
    const { user, token } = await createStudent();
    await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    const app = await importApp();

    const response = await request(app)
      .get("/users/me")
      .set("Cookie", `token=${token}`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("SESSION_INVALID");
    await request(app)
      .get("/certificate-validations/invalid")
      .set("Cookie", `token=${token}`)
      .expect(404);
  });

  it("rejects excess traffic before parsing the request body and exposes retry headers to the frontend", async () => {
    const app = await importApp({ RATE_LIMIT_GLOBAL_PER_MINUTE: "1" });
    await request(app).get("/unknown-route").expect(404);

    const response = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(429);
    expect(response.body.code).toBe("TOO_MANY_REQUESTS");
    expect(response.headers["access-control-expose-headers"]).toContain(
      "Retry-After",
    );
  });

  it("does not count CORS preflight even after the request quota is exhausted", async () => {
    const app = await importApp({
      RATE_LIMIT_ANONYMOUS_PER_MINUTE: "1",
      RATE_LIMIT_GLOBAL_PER_MINUTE: "1",
    });
    await request(app).post("/auth/logout").expect(204);

    const response = await request(app)
      .options("/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers).not.toHaveProperty("ratelimit");
    await request(app).post("/auth/logout").expect(429);
  });

  it("disables all quotas including protected routes and ignores their configured thresholds", async () => {
    const { token } = await createStudent();
    const app = await importApp({
      RATE_LIMIT_ENABLED: "false",
      RATE_LIMIT_ANONYMOUS_PER_MINUTE: "1",
      RATE_LIMIT_AUTHENTICATED_PER_MINUTE: "1",
      RATE_LIMIT_GLOBAL_PER_MINUTE: "1",
    });

    for (let count = 0; count < 3; count++) {
      const profile = await request(app)
        .get("/users/me")
        .set("Cookie", `token=${token}`);
      const activities = await request(app).get("/activities");
      expect(profile.status).toBe(200);
      expect(activities.status).toBe(200);
      expect(profile.headers).not.toHaveProperty("ratelimit");
      expect(activities.headers).not.toHaveProperty("ratelimit");
    }
  });
});
