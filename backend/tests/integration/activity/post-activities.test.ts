import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { createTeacher, createStudent } from "../../helpers/factories.js";
import { authHeader, invalidToken, signToken } from "../../helpers/auth.js";
import { daysFromNow } from "../../helpers/dates.js";


function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    title: "Oficina de Introdução à Programação",
    type: "EXTENSION",
    campus: "ARAPIRACA",
    startDate: daysFromNow(30).toISOString(),
    endDate: daysFromNow(44).toISOString(),
    slots: 40,
    description: "Introdução à lógica de programação para iniciantes.",
    area: "Tecnologia",
    workloadHours: 20,
    format: "ONLINE",
    url: "https://meet.example.com/oficina",
    ...overrides,
  };
}

describe("POST /activities", () => {
  it("returns 401 without a token", async () => {
    const response = await request(app).post("/activities").send(validPayload());
    expect(response.status).toBe(401);
  });

  it("returns 401 with an invalid token", async () => {
    const response = await request(app)
      .post("/activities")
      .set(...authHeader(invalidToken()))
      .send(validPayload());
    expect(response.status).toBe(401);
  });

  it("returns 401 with an expired token", async () => {
    const author = await createTeacher();
    const expiredToken = signToken(
      { id: author.user.id, userType: "TEACHER", isManager: false },
      "-1h",
    );

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(expiredToken))
      .send(validPayload());
    expect(response.status).toBe(401);
  });

  it.each([
    ["student", createStudent],
    ["teacher", createTeacher],
  ] as const)(
    "creates an activity for a %s and persists it with authorId from the token",
    async (_role, createUser) => {
      // authMiddleware.auth() (no options) requires a valid token but does not
      // restrict by userType/isManager: any authenticated user create an action.
      const author = await createUser();

      const response = await request(app)
        .post("/activities")
        .set(...authHeader(author.token))
        .send(validPayload());

      expect(response.status).toBe(201);
      expect(response.body.authorId).toBe(author.user.id);
      expect(response.body.status).toBe("OPEN");
      expect(response.body.availableSlots).toBe(response.body.slots);

      const persisted = await request(app).get(`/activities/${response.body.id}`);
      expect(persisted.status).toBe(200);
      expect(persisted.body.authorId).toBe(author.user.id);
    },
  );

  it("ignores an authorId sent in the body — authorship always comes from the token", async () => {
    // ActivityService.create(authorId, data) receives authorId as a separate
    // parameter (from the controller/JWT) and never reads data.authorId.
    const author = await createTeacher();
    const someoneElse = await createTeacher();

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(author.token))
      .send(validPayload({ authorId: someoneElse.user.id }));

    expect(response.status).toBe(201);
    expect(response.body.authorId).toBe(author.user.id);
  });

  it("returns 400 when format is IN_PERSON without an address", async () => {
    const author = await createTeacher();

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(author.token))
      .send(validPayload({ format: "IN_PERSON", url: undefined, address: undefined }));

        expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      message: "Validation error.",
      errors: [
        { field: "address", message: "Invalid input: expected object, received undefined" },
      ],
    });
  });

  it("returns 400 when format is HYBRID without an address", async () => {
    const author = await createTeacher();

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(author.token))
      .send(validPayload({ format: "HYBRID", address: undefined }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      message: "Validation error.",
      errors: [
        { field: "address", message: "Invalid input: expected object, received undefined" },
      ],
    });
  });

  it("returns 400 when format is HYBRID without a url", async () => {
    const author = await createTeacher();
    const address = {
      addressLine: "Av. Manoel Severino Barbosa, s/n",
      district: "Bom Sucesso",
      zipCode: "57309005",
      city: "Arapiraca",
      state: "AL",
    };

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(author.token))
      .send(validPayload({ format: "HYBRID", url: undefined, address }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      status: 400,
      message: "Validation error.",
      errors: [
        { field: "url", message: "Invalid input: expected string, received undefined" },
      ],
    });
  });

  it("returns 400 when endDate is not after startDate", async () => {
    const author = await createTeacher();

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(author.token))
      .send(
        validPayload({
          startDate: daysFromNow(44).toISOString(),
          endDate: daysFromNow(30).toISOString(),
        }),
      );

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: "startDate", message: "startDate must be before endDate." },
    ]);
  });

  it("returns 400 when the activity duration exceeds 365 days", async () => {
    const author = await createTeacher();

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(author.token))
      .send(
        validPayload({
          startDate: "2027-01-01T00:00:00.000Z",
          endDate: "2028-06-01T00:00:00.000Z", // > 365 days
        }),
      );

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        { field: "endDate", message: "Activity duration cannot exceed 365 days." },
      ]),
    );
  });

  it("returns 400 when slots exceeds the maximum of 10000", async () => {
    const author = await createTeacher();

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(author.token))
      .send(validPayload({ slots: 10_001 }));

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        { field: "slots", message: "slots cannot exceed 10000." },
      ]),
    );
  });

  it("returns 400 when workloadHours exceeds the activity duration in hours", async () => {
    const author = await createTeacher();
    const start = daysFromNow(30);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2hours

    const response = await request(app)
      .post("/activities")
      .set(...authHeader(author.token))
      .send(
        validPayload({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          workloadHours: 20, // way above 2h
        }),
      );

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual(
      expect.arrayContaining([
        {
          field: "workloadHours",
          message: "workloadHours cannot exceed the total duration of the activity.",
        },
      ]),
    );
  });
});
