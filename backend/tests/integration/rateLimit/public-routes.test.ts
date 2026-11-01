import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createStudent } from "../../helpers/factories.js";

async function importApp(enabled = "true", trustProxy = "1") {
  vi.stubEnv("RATE_LIMIT_ENABLED", enabled);
  vi.stubEnv("TRUST_PROXY", trustProxy);
  vi.resetModules();
  return (await import("@/app.js")).app;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("public route rate limits", () => {
  it("limits login to ten requests without blocking registration or certificates", async () => {
    const app = await importApp();

    for (let count = 0; count < 10; count++) {
      await request(app).post("/auth/login").send({}).expect(400);
    }
    const response = await request(app).post("/auth/login").send({});

    expect(response.status).toBe(429);
    expect(response.body.code).toBe("TOO_MANY_REQUESTS");
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(response.headers["retry-after"])).toBeLessThanOrEqual(900);
    await request(app).post("/auth/register").send({}).expect(400);
    await request(app).get("/certificate-validations/invalid").expect(404);
  });

  it("limits registration to five requests per hour", async () => {
    const app = await importApp();

    for (let count = 0; count < 5; count++) {
      await request(app).post("/auth/register").send({}).expect(400);
    }
    const response = await request(app).post("/auth/register").send({});

    expect(response.status).toBe(429);
    expect(response.body.code).toBe("TOO_MANY_REQUESTS");
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(response.headers["retry-after"])).toBeLessThanOrEqual(3600);
    expect(response.headers["ratelimit-policy"]).toContain("w=3600");
    await request(app).post("/auth/login").send({}).expect(400);
  });

  it("shares the certificate quota across validation codes and permits sixty requests", async () => {
    const app = await importApp();

    for (let count = 0; count < 60; count++) {
      await request(app)
        .get(`/certificate-validations/invalid-${count}`)
        .expect(404);
    }
    const response = await request(app).get("/certificate-validations/another");

    expect(response.status).toBe(429);
    expect(response.body.code).toBe("TOO_MANY_REQUESTS");
    expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    expect(Number(response.headers["retry-after"])).toBeLessThanOrEqual(900);
    expect(response.headers["ratelimit-policy"]).toContain("w=900");
    await request(app).post("/auth/login").send({}).expect(400);
  });

  it("counts client IPs independently behind the configured proxy", async () => {
    const app = await importApp();

    for (let count = 0; count < 10; count++) {
      await request(app)
        .post("/auth/login")
        .set("X-Forwarded-For", "192.0.2.1")
        .send({})
        .expect(400);
    }

    await request(app)
      .post("/auth/login")
      .set("X-Forwarded-For", "192.0.2.1")
      .send({})
      .expect(429);
    await request(app)
      .post("/auth/login")
      .set("X-Forwarded-For", "192.0.2.2")
      .send({})
      .expect(400);
  });

  it("leaves authenticated routes, public listings and logout unlimited", async () => {
    const { token } = await createStudent();
    const app = await importApp();

    for (let count = 0; count < 12; count++) {
      const profile = await request(app)
        .get("/users/me")
        .set("Cookie", `token=${token}`);
      const activities = await request(app).get("/activities");
      const logout = await request(app).post("/auth/logout");

      expect(profile.status).toBe(200);
      expect(activities.status).toBe(200);
      expect(logout.status).toBe(204);
      for (const response of [profile, activities, logout]) {
        expect(response.headers).not.toHaveProperty("ratelimit");
      }
    }
  });

  it("disables all three limits with RATE_LIMIT_ENABLED=false", async () => {
    const app = await importApp("false");

    for (let count = 0; count < 61; count++) {
      const certificate = await request(app).get(
        "/certificate-validations/invalid",
      );
      expect(certificate.status).toBe(404);
      expect(certificate.headers).not.toHaveProperty("ratelimit");
      if (count < 11) {
        const login = await request(app).post("/auth/login").send({});
        const registration = await request(app).post("/auth/register").send({});
        expect(login.status).toBe(400);
        expect(registration.status).toBe(400);
        expect(login.headers).not.toHaveProperty("ratelimit");
        expect(registration.headers).not.toHaveProperty("ratelimit");
      }
    }
  });
});
