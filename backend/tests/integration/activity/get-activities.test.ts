import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import { createTeacher, createStudent, createActivity, createEnrollment } from "../../helpers/factories.js";

/**
* Scope of this file: checklist items for issue #126 regarding the GET
* /activities endpoint, excluding the `area` filter (which is already fully
* covered by list-activities.test.ts and is not duplicated here). 
*
* Limits and messages confirmed in ActivityService.list: the actual maximum
* `limit` is 100 (not 50, as the Bruno contract documented prior to the fix
* recorded in List-activities.yml); invalid `page`/`limit` values ​​trigger
* "page must be a positive integer." / "limit can not exceed 100.". 
*/

describe("GET /activities", () => {
  it("is public: answers without any token", async () => {
    const author = await createTeacher();
    await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app).get("/activities");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("activities");
    expect(response.body).toHaveProperty("total");
  });

  it("paginates: limit=2 returns 2 items and total reflects the whole matching set", async () => {
    const author = await createTeacher();
    for (let i = 0; i < 5; i++) {
      await createActivity(author.user.id, { status: "OPEN" });
    }

    const response = await request(app).get("/activities").query({ limit: 2, page: 1 });

    expect(response.status).toBe(200);
    expect(response.body.activities).toHaveLength(2);
    expect(response.body.total).toBe(5);
  });

  it("returns 400 when limit exceeds the real maximum of 100", async () => {
    const response = await request(app).get("/activities").query({ limit: 101 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toEqual([
      { field: "limit", message: "limit can not exceed 100." },
    ]);
  });

  it("returns 400 when page is 0", async () => {
    const response = await request(app).get("/activities").query({ page: 0 });

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: "page", message: "page must be a positive integer." },
    ]);
  });

  it("filters by type", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { type: "COURSE" });
    await createActivity(author.user.id, { type: "EVENT" });

    const response = await request(app).get("/activities").query({ type: "COURSE" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("filters by format", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { format: "ONLINE" });
    await createActivity(author.user.id, { format: "IN_PERSON" });

    const response = await request(app).get("/activities").query({ format: "ONLINE" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("filters by status", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { status: "OPEN" });
    await createActivity(author.user.id, { status: "IN_PROGRESS" });

    const response = await request(app).get("/activities").query({ status: "OPEN" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("filters by campus", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { campus: "ARAPIRACA" });
    await createActivity(author.user.id, { campus: "MACEIO" });

    const response = await request(app).get("/activities").query({ campus: "ARAPIRACA" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("computes availableSlots from APPROVED enrollments only", async () => {
    const author = await createTeacher();
    const activity = await createActivity(author.user.id, { slots: 10, status: "OPEN" });

    const student1 = await createStudent();
    const student2 = await createStudent();
    const student3 = await createStudent();

    await createEnrollment(student1.user.id, activity.id, { status: "APPROVED" });
    await createEnrollment(student2.user.id, activity.id, { status: "APPROVED" });
    await createEnrollment(student3.user.id, activity.id, { status: "REJECTED" });

    const response = await request(app).get("/activities");

    expect(response.status).toBe(200);
    expect(response.body.activities[0].availableSlots).toBe(8);
  });

  it("does not list a soft-deleted activity", async () => {
    const author = await createTeacher();
    const deleted = await createActivity(author.user.id, {
      status: "OPEN",
      deletedAt: new Date(),
    });
    const visible = await createActivity(author.user.id, { status: "OPEN" });

    const response = await request(app).get("/activities");

    const ids = response.body.activities.map((a: { id: string }) => a.id);
    expect(ids).toContain(visible.id);
    expect(ids).not.toContain(deleted.id);
  });
});

/**
 * Issues #210 (empty filter / fractional pagination) and #211 (invalid
 * campus). These replace the old "accepted silently" behavior with a 400 in
 * the offending field, keeping the existing `{ field, message }` format.
 */
describe("GET /activities — strict query validation", () => {
  // ---------- #210: present-and-empty filter ----------
  it("returns 400 on the 'type' field for an empty ?type=", async () => {
    const response = await request(app).get("/activities?type=");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toEqual([
      {
        field: "type",
        message:
          "type must be one of the following: EXTENSION, COURSE, EVENT, LECTURE, OTHER.",
      },
    ]);
  });

  it.each(["format", "status", "campus", "order", "orderBy", "page", "limit"])(
    "returns 400 on the '%s' field for an empty ?%s=",
    async (field) => {
      const response = await request(app).get(`/activities?${field}=`);

      expect(response.status).toBe(400);
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].field).toBe(field);
    },
  );

  it("still returns 200 and does NOT filter by type when 'type' is absent", async () => {
    const author = await createTeacher();
    await createActivity(author.user.id, { type: "COURSE" });
    await createActivity(author.user.id, { type: "EVENT" });

    const response = await request(app).get("/activities");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
  });

  // ---------- #210: fractional / suffixed pagination ----------
  it("returns 400 on the 'limit' field for a fractional ?limit=10.9", async () => {
    const response = await request(app).get("/activities?limit=10.9");

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: "limit", message: "limit must be a positive integer." },
    ]);
  });

  it("returns 400 on the 'limit' field for a suffixed ?limit=20abc", async () => {
    const response = await request(app).get("/activities?limit=20abc");

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: "limit", message: "limit must be a positive integer." },
    ]);
  });

  it("returns 400 on the 'page' field for a fractional ?page=1.5", async () => {
    const response = await request(app).get("/activities?page=1.5");

    expect(response.status).toBe(400);
    expect(response.body.errors).toEqual([
      { field: "page", message: "page must be a positive integer." },
    ]);
  });

  it("still returns 200 for a valid ?limit=20", async () => {
    const response = await request(app).get("/activities?limit=20");

    expect(response.status).toBe(200);
  });

  // ---------- #211: invalid campus ----------
  it("returns 400 (not 500) on the 'campus' field for an unknown campus", async () => {
    const response = await request(app).get("/activities?campus=INVALIDO");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0].field).toBe("campus");
    expect(response.body.errors[0].message).toContain("ARAPIRACA");
  });

  it.each(["maceio", "MACEIÓ"])(
    "returns 400 (not 500) for the campus spelling %j that is not a CampusLocation member",
    async (campus) => {
      const response = await request(app)
        .get("/activities")
        .query({ campus });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].field).toBe("campus");
    },
  );

  it("still returns 200 and filters for a valid ?campus=ARAPIRACA", async () => {
    const author = await createTeacher();
    const target = await createActivity(author.user.id, { campus: "ARAPIRACA" });
    await createActivity(author.user.id, { campus: "MACEIO" });

    const response = await request(app).get("/activities?campus=ARAPIRACA");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("reports an invalid campus and an invalid type in a single ValidationError with two items", async () => {
    const response = await request(app).get(
      "/activities?type=INVALIDO&campus=INVALIDO",
    );

    expect(response.status).toBe(400);
    expect(response.body.errors).toHaveLength(2);
    expect(
      response.body.errors.map((e: { field: string }) => e.field),
    ).toEqual(["type", "campus"]);
  });

  it("keeps 'search' as free text: an unusual search is never a 400", async () => {
    const response = await request(app)
      .get("/activities")
      .query({ search: "MACEIÓ ?? 10.9 !!" });

    expect(response.status).toBe(200);
  });
});
