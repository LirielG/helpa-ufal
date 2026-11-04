import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import {
  createManager,
  createStudent,
  createTeacher,
} from "../../helpers/factories.js";
import { authCookie, invalidToken } from "../../helpers/auth.js";

const routes = [
  { method: "get", path: "/activities/:id", field: "activityId" },
  {
    method: "patch",
    path: "/activities/:id",
    field: "activityId",
    body: { title: "Updated" },
  },
  { method: "delete", path: "/activities/:id", field: "activityId" },
  {
    method: "put",
    path: "/activities/:id/status",
    field: "activityId",
    body: { status: "IN_PROGRESS" },
  },
  {
    method: "post",
    path: "/activities/:id/reports",
    field: "activityId",
    body: { category: "SPAM" },
  },
  {
    method: "put",
    path: "/activities/:id/enrollments/me",
    field: "activityId",
  },
  {
    method: "delete",
    path: "/activities/:id/enrollments/me",
    field: "activityId",
  },
  { method: "get", path: "/activities/:id/enrollments", field: "activityId" },
  {
    method: "put",
    path: "/enrollments/:id/attendance",
    field: "enrollmentId",
    body: { attended: false },
  },
  { method: "put", path: "/reports/:id/resolution", field: "reportId" },
] as const;

function invalidIdResponse(field: string) {
  return {
    status: 400,
    code: "VALIDATION_ERROR",
    message: "Validation error.",
    errors: [
      {
        field,
        code: "INVALID_UUID",
        message: `${field} must be a valid UUID.`,
      },
    ],
  };
}

function callRoute(route: (typeof routes)[number], id: string, token?: string) {
  const req = request(app)[route.method](route.path.replace(":id", id));
  if (token !== undefined) req.set(...authCookie(token));
  if ("body" in route) req.send(route.body);
  return req;
}

describe("path parameter validation", () => {
  it("returns the shared INVALID_UUID envelope for activity details", async () => {
    const response = await request(app).get("/activities/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Validation error.",
      errors: [
        {
          field: "activityId",
          code: "INVALID_UUID",
          message: "activityId must be a valid UUID.",
        },
      ],
    });
  });

  it.each(routes)(
    "returns a consistent 400 for $method $path",
    async (route) => {
      const manager = await createManager();
      const response = await callRoute(route, "not-a-uuid", manager.token);

      expect(response.status).toBe(400);
      expect(response.body).toEqual(invalidIdResponse(route.field));
    },
  );

  it.each(routes)("rejects a non-v4 UUID for $method $path", async (route) => {
    const manager = await createManager();
    const response = await callRoute(
      route,
      "a1b2c3d4-0000-1000-8000-000000000001",
      manager.token,
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual(invalidIdResponse(route.field));
  });

  it.each(routes)(
    "accepts boundary v4 UUIDs and preserves 404 for $method $path",
    async (route) => {
      const manager = await createManager();
      for (const id of [
        "00000000-0000-4000-8000-000000000000",
        "FFFFFFFF-FFFF-4FFF-BFFF-FFFFFFFFFFFF",
      ]) {
        const response = await callRoute(route, id, manager.token);
        expect(response.status).toBe(404);
        expect(response.body).not.toHaveProperty("errors");
      }
    },
  );

  it.each(routes)(
    "checks a present invalid token before format for $method $path",
    async (route) => {
      const response = await callRoute(route, "not-a-uuid", invalidToken());

      expect(response.status).toBe(401);
      expect(response.body.code).toBe("UNAUTHENTICATED");
    },
  );

  it.each(
    routes.filter(
      (route) => route.path !== "/activities/:id" || route.method !== "get",
    ),
  )(
    "checks missing credentials before format for $method $path",
    async (route) => {
      const response = await callRoute(route, "not-a-uuid");
      expect(response.status).toBe(401);
    },
  );

  it("checks the manager role before a malformed reportId", async () => {
    const student = await createStudent();
    const response = await request(app)
      .put("/reports/not-a-uuid/resolution")
      .set(...authCookie(student.token));

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      code: "FORBIDDEN",
      message: "User is not a manager.",
    });
  });

  it("combines invalid activityId and pagination before checking existence or ownership", async () => {
    const student = await createStudent();
    const response = await request(app)
      .get("/activities/not-a-uuid/enrollments?page=0&limit=51")
      .set(...authCookie(student.token));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ...invalidIdResponse("activityId"),
      errors: [
        ...invalidIdResponse("activityId").errors,
        {
          field: "page",
          code: "VALIDATION_ERROR",
          message: "page must be a positive integer.",
        },
        {
          field: "limit",
          code: "VALIDATION_ERROR",
          message: "limit must be at most 50.",
        },
      ],
    });
  });

  it("combines invalid enrollmentId and attendance body rules", async () => {
    const author = await createTeacher();
    const response = await request(app)
      .put("/enrollments/not-a-uuid/attendance")
      .set(...authCookie(author.token))
      .send({ attended: true });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ...invalidIdResponse("enrollmentId"),
      errors: [
        ...invalidIdResponse("enrollmentId").errors,
        {
          field: "workloadHours",
          code: "VALIDATION_ERROR",
          message: "workloadHours is required when attended is true.",
        },
      ],
    });
  });

  it.each([
    {
      method: "post",
      path: "/activities/not-a-uuid/reports",
      body: { category: "INVALID" },
      field: "category",
    },
    {
      method: "put",
      path: "/activities/not-a-uuid/status",
      body: { status: "OPEN" },
      field: "status",
    },
  ] as const)(
    "combines invalid activityId and $field for $method $path",
    async ({ method, path, body, field }) => {
      const author = await createTeacher();
      const response = await request(app)
        [method](path)
        .set(...authCookie(author.token))
        .send(body);

      expect(response.status).toBe(400);
      expect(response.body.errors).toHaveLength(2);
      expect(response.body.errors).toContainEqual(
        invalidIdResponse("activityId").errors[0],
      );
      expect(response.body.errors).toContainEqual(
        expect.objectContaining({ field, code: "VALIDATION_ERROR" }),
      );
    },
  );

  it("combines an invalid PATCH id and body in one validation response", async () => {
    const author = await createTeacher();
    const response = await request(app)
      .patch("/activities/not-a-uuid")
      .set(...authCookie(author.token))
      .send({ startDate: "not-a-date" });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toHaveLength(2);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: "activityId",
          code: "INVALID_UUID",
          message: "activityId must be a valid UUID.",
        },
        expect.objectContaining({
          field: "startDate",
          code: "VALIDATION_ERROR",
        }),
      ]),
    );
  });
});
