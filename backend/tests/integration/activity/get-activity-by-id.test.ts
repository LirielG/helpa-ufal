import { describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { authCookie, invalidToken, signToken } from "../../helpers/auth.js";
import { app } from "@/app.js";
import {
  createTeacher,
  createStudent,
  createManager,
  createActivity,
  createEnrollment,
  createModerationDecision,
  createReport,
  anAddress,
} from "../../helpers/factories.js";

describe("GET /activities/:activityId", () => {
  it("returns 200 with the full activity detail, including address", async () => {
    const author = await createTeacher();
    const address = anAddress();

    const activity = await createActivity(author.user.id, {
      title: "Oficina de Introdução à Programação",
      type: "COURSE",
      campus: "ARAPIRACA",
      slots: 40,
      status: "OPEN",
      format: "HYBRID",
      url: "https://meet.example.com/oficina",
      workloadHours: 20,
      area: "Tecnologia",
      description: "Introdução à lógica de programação para iniciantes.",
      address,
    });

    const response = await request(app).get(`/activities/${activity.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: activity.id,
      authorId: author.user.id,
      title: "Oficina de Introdução à Programação",
      type: "COURSE",
      campus: "ARAPIRACA",
      slots: 40,
      status: "OPEN",
      moderation: null,
      details: {
        description: "Introdução à lógica de programação para iniciantes.",
        area: "Tecnologia",
        format: "HYBRID",
        url: "https://meet.example.com/oficina",
        workloadHours: 20,
        address: {
          addressLine: address.addressLine,
          district: address.district,
          zipCode: address.zipCode,
          city: address.city,
          state: address.state,
        },
      },
    });
    expect(response.body).not.toHaveProperty("passwordHash");
  });

  it("computes availableSlots correctly with APPROVED enrollments", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      slots: 10,
      status: "OPEN",
    });

    const student1 = await createStudent();
    const student2 = await createStudent();
    const student3 = await createStudent();

    await createEnrollment(student1.user.id, activity.id, {
      status: "APPROVED",
    });
    await createEnrollment(student2.user.id, activity.id, {
      status: "APPROVED",
    });
    await createEnrollment(student3.user.id, activity.id, {
      status: "REJECTED",
    });

    const response = await request(app).get(`/activities/${activity.id}`);

    expect(response.status).toBe(200);
    expect(response.body.availableSlots).toBe(8);
  });

  it("returns 400 when activityId is not a valid UUID", async () => {
    const response = await request(app).get("/activities/not-a-uuid");

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      {
        field: "activityId",
        code: "INVALID_UUID",
        message: "activityId must be a valid UUID.",
      },
    ]);
  });

  it("returns 404 when the UUID does not exist", async () => {
    const response = await request(app).get(`/activities/${randomUUID()}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "Activity not found.",
    });
  });

  it("returns 404 for a soft-deleted activity", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, {
      status: "OPEN",
      deletedAt: new Date(),
    });

    const response = await request(app).get(`/activities/${activity.id}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "Activity not found.",
    });
  });

  describe("moderation removal", () => {
    it("returns 410 ACTIVITY_REMOVED with no activity data for anonymous and regular users", async () => {
      const author = await createTeacher();
      const manager = await createManager();
      const regularUser = await createStudent();
      const removedAt = new Date("2026-09-10T15:00:00.000Z");
      const activity = await createActivity(author.user.id, {
        title: "Título que não pode vazar",
        status: "OPEN",
        removedByModerationAt: removedAt,
      });
      await createModerationDecision(activity.id, manager.user.id, {
        verdict: "UPHELD",
        justification: "Violou as regras.",
      });

      for (const res of [
        await request(app).get(`/activities/${activity.id}`),
        await request(app)
          .get(`/activities/${activity.id}`)
          .set(...authCookie(regularUser.token)),
      ]) {
        expect(res.status).toBe(410);
        expect(res.body).toEqual({
          status: 410,
          code: "ACTIVITY_REMOVED",
          message: "This activity was removed by moderation.",
        });
        expect(JSON.stringify(res.body)).not.toContain(
          "Título que não pode vazar",
        );
      }
    });

    it("returns 200 with moderation populated for the author and for a manager", async () => {
      const author = await createTeacher();
      const manager = await createManager();
      const removedAt = new Date("2026-09-10T15:00:00.000Z");
      const activity = await createActivity(author.user.id, {
        status: "OPEN",
        removedByModerationAt: removedAt,
      });
      await createModerationDecision(activity.id, manager.user.id, {
        verdict: "UPHELD",
        justification: "Ação viola as diretrizes.",
      });

      for (const actor of [author, manager]) {
        const res = await request(app)
          .get(`/activities/${activity.id}`)
          .set(...authCookie(actor.token));

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          id: activity.id,
          title: activity.title,
          moderation: {
            removedAt: removedAt.toISOString(),
            justification: "Ação viola as diretrizes.",
          },
          enrollmentStatus: null,
        });
      }
    });
  });

  describe("enrollmentStatus", () => {
    it("omits the key when the request has no token", async () => {
      const author = await createTeacher();
      const activity = await createActivity(author.user.id, { status: "OPEN" });

      const response = await request(app).get(`/activities/${activity.id}`);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveProperty("enrollmentStatus");
    });

    it.each(["malformed", "tampered", "expired", "empty"] as const)(
      "returns 401 for a present %s token",
      async (kind) => {
        const author = await createTeacher();
        const activity = await createActivity(author.user.id, {
          status: "OPEN",
        });
        const tokens = {
          malformed: "invalid-token",
          tampered: invalidToken(),
          expired: signToken(author.user, "-1s"),
          empty: "",
        };

        const response = await request(app)
          .get(`/activities/${activity.id}`)
          .set(...authCookie(tokens[kind]));

        expect(response.status).toBe(401);
        expect(response.body.code).toBe("UNAUTHENTICATED");
        expect(response.body).not.toHaveProperty("enrollmentStatus");
      },
    );

    it("returns null for an authenticated user who never enrolled", async () => {
      const author = await createTeacher();
      const student = await createStudent();
      const activity = await createActivity(author.user.id, { status: "OPEN" });

      const response = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(student.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("enrollmentStatus", null);
    });

    it("returns APPROVED for an active enrollment", async () => {
      const author = await createTeacher();
      const student = await createStudent();
      const activity = await createActivity(author.user.id, { status: "OPEN" });
      await createEnrollment(student.user.id, activity.id, {
        status: "APPROVED",
      });

      const response = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(student.token));

      expect(response.status).toBe(200);
      expect(response.body.enrollmentStatus).toBe("APPROVED");
    });

    it("returns CANCELLED for a cancelled enrollment", async () => {
      const author = await createTeacher();
      const student = await createStudent();
      const activity = await createActivity(author.user.id, { status: "OPEN" });
      await createEnrollment(student.user.id, activity.id, {
        status: "CANCELLED",
      });

      const response = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(student.token));

      expect(response.status).toBe(200);
      expect(response.body.enrollmentStatus).toBe("CANCELLED");
    });

    it("reflects only the token user's enrollment, never another student's", async () => {
      const author = await createTeacher();
      const enrolled = await createStudent();
      const requester = await createStudent();
      const activity = await createActivity(author.user.id, { status: "OPEN" });
      await createEnrollment(enrolled.user.id, activity.id, {
        status: "APPROVED",
      });

      const response = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(requester.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("enrollmentStatus", null);
    });
  });

  // Lets the client tell "Denunciar ação" from "Ação denunciada" after a
  // reload, without a second request.
  describe("reportedByMe", () => {
    it("is false, and present, when the request has no token", async () => {
      const author = await createTeacher();
      const activity = await createActivity(author.user.id, { status: "OPEN" });

      const response = await request(app).get(`/activities/${activity.id}`);

      expect(response.status).toBe(200);
      // Unlike enrollmentStatus, the key is never absent on this route.
      expect(response.body).toHaveProperty("reportedByMe", false);
      expect(response.body).not.toHaveProperty("enrollmentStatus");
    });

    it.each(["malformed", "tampered", "expired", "empty"] as const)(
      "is not exposed when a present %s token answers 401",
      async (kind) => {
        const author = await createTeacher();
        const activity = await createActivity(author.user.id, {
          status: "OPEN",
        });
        const tokens = {
          malformed: "invalid-token",
          tampered: invalidToken(),
          expired: signToken(author.user, "-1s"),
          empty: "",
        };

        const response = await request(app)
          .get(`/activities/${activity.id}`)
          .set(...authCookie(tokens[kind]));

        expect(response.status).toBe(401);
        expect(response.body).not.toHaveProperty("reportedByMe");
      },
    );

    it("is false for an authenticated user who never reported the activity", async () => {
      const author = await createTeacher();
      const student = await createStudent();
      const activity = await createActivity(author.user.id, { status: "OPEN" });

      const response = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(student.token));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("reportedByMe", false);
    });

    it("is true for the user whose report is still open", async () => {
      const author = await createTeacher();
      const student = await createStudent();
      const activity = await createActivity(author.user.id, { status: "OPEN" });
      await createReport(activity.id, student.user.id);

      const response = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(student.token));

      expect(response.status).toBe(200);
      expect(response.body.reportedByMe).toBe(true);
    });

    it("stays true after the moderation already decided the report", async () => {
      const author = await createTeacher();
      const student = await createStudent();
      const manager = await createManager();
      const activity = await createActivity(author.user.id, { status: "OPEN" });
      // REJECTED keeps the activity visible; UPHELD would answer 410 instead.
      const decision = await createModerationDecision(
        activity.id,
        manager.user.id,
        { verdict: "REJECTED" },
      );
      await createReport(activity.id, student.user.id, {
        decisionId: decision.id,
      });

      const response = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(student.token));

      expect(response.status).toBe(200);
      expect(response.body.reportedByMe).toBe(true);
    });

    it("reflects only the token user's report, never another user's", async () => {
      const author = await createTeacher();
      const reporter = await createStudent();
      const requester = await createStudent();
      const activity = await createActivity(author.user.id, { status: "OPEN" });
      await createReport(activity.id, reporter.user.id);

      const asRequester = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(requester.token));
      const asReporter = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(reporter.token));

      expect(asRequester.body.reportedByMe).toBe(false);
      expect(asReporter.body.reportedByMe).toBe(true);
    });

    it("only concerns the activity asked for, not the user's reports on others", async () => {
      const author = await createTeacher();
      const student = await createStudent();
      const reported = await createActivity(author.user.id, { status: "OPEN" });
      const other = await createActivity(author.user.id, { status: "OPEN" });
      await createReport(reported.id, student.user.id);

      const response = await request(app)
        .get(`/activities/${other.id}`)
        .set(...authCookie(student.token));

      expect(response.status).toBe(200);
      expect(response.body.reportedByMe).toBe(false);
    });

    it("turns true right after the user reports through the API", async () => {
      const author = await createTeacher();
      const student = await createStudent();
      const activity = await createActivity(author.user.id, { status: "OPEN" });

      const before = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(student.token));
      await request(app)
        .post(`/activities/${activity.id}/reports`)
        .set(...authCookie(student.token))
        .send({ category: "SPAM", description: "Spam content." })
        .expect(201);
      const after = await request(app)
        .get(`/activities/${activity.id}`)
        .set(...authCookie(student.token));

      expect(before.body.reportedByMe).toBe(false);
      expect(after.body.reportedByMe).toBe(true);
    });

    it("is not part of the listing responses, only of the detail", async () => {
      const author = await createTeacher();
      const student = await createStudent();
      const activity = await createActivity(author.user.id, { status: "OPEN" });
      await createEnrollment(student.user.id, activity.id, {
        status: "APPROVED",
      });
      await createReport(activity.id, student.user.id);

      const list = await request(app)
        .get("/activities")
        .set(...authCookie(student.token));
      const mine = await request(app)
        .get("/users/me/activities?filter=enrolled")
        .set(...authCookie(student.token));

      const findById = (items: { id: string }[]) =>
        items.find((item) => item.id === activity.id);

      expect(list.status).toBe(200);
      const listed = findById(list.body.items);
      expect(listed).toBeDefined();
      expect(listed).not.toHaveProperty("reportedByMe");
      expect(mine.status).toBe(200);
      const enrolled = findById(mine.body.items);
      expect(enrolled).toBeDefined();
      expect(enrolled).not.toHaveProperty("reportedByMe");
    });
  });
});
