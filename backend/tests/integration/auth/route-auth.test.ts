import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";

describe("activity write authentication", () => {
  it.each([
    ["post", "/activities"],
    ["put", "/activities/not-a-uuid/enrollments/me"],
    ["delete", "/activities/not-a-uuid/enrollments/me"],
    ["patch", "/activities/not-a-uuid"],
    ["put", "/activities/not-a-uuid/status"],
    ["delete", "/activities/not-a-uuid"],
  ] as const)(
    "%s %s returns 401 without a token before validating params or body",
    async (method, path) => {
      const response = await request(app)[method](path).send({});

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHENTICATED");
    },
  );
});
