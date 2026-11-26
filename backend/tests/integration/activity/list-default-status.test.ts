import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { createTeacher, createActivity } from "../../helpers/factories.js";
import { daysFromNow } from "../../helpers/dates.js";

async function seedOneActivityPerCase() {
  const { user: author } = await createTeacher();

  const openFuture = await createActivity(author.id, {
    status: "OPEN",
    startDate: daysFromNow(5),
    endDate: daysFromNow(6),
  });
  const openStarted = await createActivity(author.id, {
    status: "OPEN",
    startDate: daysFromNow(-2),
    endDate: daysFromNow(1),
  });
  const inProgress = await createActivity(author.id, {
    status: "IN_PROGRESS",
    startDate: daysFromNow(-2),
    endDate: daysFromNow(1),
  });
  const completed = await createActivity(author.id, {
    status: "COMPLETED",
    startDate: daysFromNow(-5),
    endDate: daysFromNow(-4),
  });
  const cancelled = await createActivity(author.id, {
    status: "CANCELLED",
    startDate: daysFromNow(5),
    endDate: daysFromNow(6),
  });

  return { author, openFuture, openStarted, inProgress, completed, cancelled };
}

const idsOf = (body: { items: { id: string }[] }) =>
  body.items.map((item) => item.id).sort();

describe("GET /activities — default status", () => {
  it("without status, lists only OPEN activities that have not started", async () => {
    const { openFuture } = await seedOneActivityPerCase();

    const response = await request(app).get("/activities");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(idsOf(response.body)).toEqual([openFuture.id]);
  });

  it("status=ALL lists every activity that was not deleted", async () => {
    const {
      author,
      openFuture,
      openStarted,
      inProgress,
      completed,
      cancelled,
    } = await seedOneActivityPerCase();
    await createActivity(author.id, { status: "OPEN", deletedAt: new Date() });

    const response = await request(app)
      .get("/activities")
      .query({ status: "ALL" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(5);
    expect(idsOf(response.body)).toEqual(
      [openFuture, openStarted, inProgress, completed, cancelled]
        .map((activity) => activity.id)
        .sort(),
    );
  });

  it("status=OPEN lists the OPEN activities of any date", async () => {
    const { openFuture, openStarted } = await seedOneActivityPerCase();

    const response = await request(app)
      .get("/activities")
      .query({ status: "OPEN" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(idsOf(response.body)).toEqual(
      [openFuture.id, openStarted.id].sort(),
    );
  });
});
