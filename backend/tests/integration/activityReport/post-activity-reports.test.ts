import { describe, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { app } from "@/app.js";
import {
  createTeacher,
  createStudent,
  createManager,
  createActivity,
} from "../../helpers/factories.js";
import { authCookie } from "../../helpers/auth.js";

describe("POST /activities/:activityId/reports", () => {
  it("returns 401 without a token", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app)
      .post(`/activities/${activity.id}/reports`)
      .send({ category: "SPAM", description: "Spam content." });

    expect(response.status).toBe(401);
  });

  it("registers a valid report linked to the requesting user", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });
    const reporter = await createStudent();

    const response = await request(app)
      .post(`/activities/${activity.id}/reports`)
      .set(...authCookie(reporter.token))
      .send({
        category: "MISINFORMATION",
        description: "The address provided is incorrect.",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      activityId: activity.id,
      userId: reporter.user.id,
      category: "MISINFORMATION",
      description: "The address provided is incorrect.",
    });
  });

  it("returns 409 for a duplicate report from the same user on the same activity", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });
    const reporter = await createStudent();

    const first = await request(app)
      .post(`/activities/${activity.id}/reports`)
      .set(...authCookie(reporter.token))
      .send({ category: "SPAM", description: "First report." });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/activities/${activity.id}/reports`)
      .set(...authCookie(reporter.token))
      .send({
        category: "SPAM",
        description: "Second report, same user/activity.",
      });

    expect(second.status).toBe(409);
    expect(second.body).toEqual({
      status: 409,
      code: "CONFLICT",
      message: "You have already reported this activity.",
    });
  });

  it("returns 400 for an invalid category", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });
    const reporter = await createStudent();

    const response = await request(app)
      .post(`/activities/${activity.id}/reports`)
      .set(...authCookie(reporter.token))
      .send({ category: "NOT_A_CATEGORY", description: "Invalid category." });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
  });

  it("returns 400 when the activity id is not a valid UUID", async () => {
    const reporter = await createStudent();

    const response = await request(app)
      .post("/activities/not-a-uuid/reports")
      .set(...authCookie(reporter.token))
      .send({ category: "SPAM", description: "Invalid id." });

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

  it("returns 404 for a non-existent activity", async () => {
    const reporter = await createStudent();

    const response = await request(app)
      .post(`/activities/${randomUUID()}/reports`)
      .set(...authCookie(reporter.token))
      .send({ category: "SPAM", description: "Activity does not exist." });

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
    const reporter = await createStudent();

    const response = await request(app)
      .post(`/activities/${activity.id}/reports`)
      .set(...authCookie(reporter.token))
      .send({ category: "SPAM", description: "Activity was soft-deleted." });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      status: 404,
      code: "NOT_FOUND",
      message: "Activity not found.",
    });
  });

  it("returns 403 when the activity author tries to report their own activity", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app)
      .post(`/activities/${activity.id}/reports`)
      .set(...authCookie(author.token))
      .send({ category: "SPAM", description: "Self report attempt." });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      status: 403,
      code: "FORBIDDEN",
      message: "Activity authors cannot report their own activity.",
    });
  });

  it("returns 410 ACTIVITY_REMOVED for a moderation-removed activity (including author and manager)", async () => {
    const author = await createTeacher();
    const manager = await createManager();
    const reporter = await createStudent();
    const activity = await createActivity(author.user.id, {
      status: "OPEN",
      removedByModerationAt: new Date(),
    });

    for (const actor of [reporter, author, manager]) {
      const response = await request(app)
        .post(`/activities/${activity.id}/reports`)
        .set(...authCookie(actor.token))
        .send({ category: "SPAM", description: "Moderation removed." });

      expect(response.status).toBe(410);
      expect(response.body).toEqual({
        status: 410,
        code: "ACTIVITY_REMOVED",
        message: "This activity was removed by moderation.",
      });
    }
  });
});
