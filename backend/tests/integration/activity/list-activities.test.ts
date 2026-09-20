import { describe, it, expect } from "vitest"; // globals are disabled: explicit import
import request from "supertest";
import { app } from "@/app.js";
import { createTeacher, createActivity } from "../../helpers/factories.js";

describe("GET /activities — area filter", () => {
  // ---------- 200 - OK ----------
  it("returns only the activities of the requested area", async () => {
    const { user: author } = await createTeacher();
    const first = await createActivity(author.id, { area: "Saúde" });
    const second = await createActivity(author.id, { area: "Saúde" });
    await createActivity(author.id, { area: "Educação" });

    const response = await request(app)
      .get("/activities")
      .query({ area: "Saúde" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    // Ordering (createdAt desc) is not the filter's business: compare as a set.
    const ids = response.body.activities.map((a: { id: string }) => a.id);
    expect([...ids].sort()).toEqual([first.id, second.id].sort());
    for (const item of response.body.activities) {
      expect(item.details.area).toBe("Saúde");
    }
  });

  it("matches case-insensitively and trims surrounding spaces", async () => {
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });

    for (const area of ["saúde", "SAÚDE", "  saúde  "]) {
      const response = await request(app)
        .get("/activities")
        .query({ area });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(1);
      expect(response.body.activities[0].details.area).toBe("Saúde");
    }
  });

  it("answers an unknown area with an empty page instead of a 404 ", async () => {
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });

    const response = await request(app)
      .get("/activities")
      .query({ area: "Astrobiologia" });

    expect(response.status).toBe(200);
    expect(response.body.activities).toEqual([]);
    expect(response.body.total).toBe(0);
  });

  it("without area, returns the same listing as before — and stays soft-delete blind", async () => {
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });
    await createActivity(author.id, { area: "Educação" });
    await createActivity(author.id, { area: "Tecnologia" });
    await createActivity(author.id, { area: "Saúde", deletedAt: new Date() });

    const response = await request(app).get("/activities");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3); // the soft-deleted one stays invisible
  });

  it("treats an empty or whitespace-only area as no filter — never a 400", async () => {
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });
    await createActivity(author.id, { area: "Educação" });

    for (const area of ["", "   "]) {
      const response = await request(app)
        .get("/activities")
        .query({ area });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(2);
    }
  });

  // ---------- 200 - OK: composition with other filters ----------
  it("applies area AND format together — no silent overwrite between them", async () => {
    // The issue's trap: `whereClause.details` assigned twice would make the
    // second filter erase the first. Two "Saúde" rows with different formats
    // make that failure loud.
    const { user: author } = await createTeacher();
    const target = await createActivity(author.id, {
      area: "Saúde",
      format: "ONLINE",
    });
    await createActivity(author.id, { area: "Saúde", format: "IN_PERSON" });
    await createActivity(author.id, { area: "Educação", format: "ONLINE" });

    const response = await request(app)
      .get("/activities")
      .query({ area: "Saúde", format: "ONLINE" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("combines area with search, type, status and campus", async () => {
    // One target survives all five restrictions; each decoy is killed by
    // exactly one of them, so every filter must work for the test to pass.
    const { user: author } = await createTeacher();
    const target = await createActivity(author.id, {
      area: "Saúde",
      type: "COURSE",
      status: "OPEN",
      campus: "ARAPIRACA",
      title: "Primeiros Socorros",
    });
    await createActivity(author.id, {
      area: "Saúde",
      type: "EVENT",
      title: "Primeiros Socorros",
    });
    await createActivity(author.id, {
      area: "Saúde",
      campus: "MACEIO",
      title: "Primeiros Socorros",
    });
    await createActivity(author.id, {
      area: "Saúde",
      status: "COMPLETED",
      title: "Primeiros Socorros",
    });
    await createActivity(author.id, {
      area: "Educação",
      title: "Primeiros Socorros",
    });

    const response = await request(app).get("/activities").query({
      area: "Saúde",
      search: "socorros",
      type: "COURSE",
      status: "OPEN",
      campus: "ARAPIRACA",
    });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].id).toBe(target.id);
  });

  it("still lists CANCELLED activities when filtering by area", async () => {
    // The CANCELLED exclusion applies ONLY to GET /activities/filters (the
    // options route). The listing filter must not hide them.
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde", status: "CANCELLED" });

    const response = await request(app)
      .get("/activities")
      .query({ area: "Saúde" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.activities[0].status).toBe("CANCELLED");
  });

  // ---------- 200 - OK: pagination over the filtered subset ----------
  it("reports the filtered total and paginates only within the matching subset", async () => {
    const { user: author } = await createTeacher();
    for (let i = 0; i < 5; i++) {
      await createActivity(author.id, { area: "Saúde" });
    }
    await createActivity(author.id, { area: "Educação" });
    await createActivity(author.id, { area: "Educação" });

    const seen = new Set<string>();
    for (const page of [1, 2, 3]) {
      const response = await request(app)
        .get("/activities")
        .query({ area: "Saúde", limit: 2, page });

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(5);
      for (const item of response.body.activities) {
        expect(item.details.area).toBe("Saúde");
        expect(seen.has(item.id)).toBe(false); // no repeats across pages
        seen.add(item.id);
      }
    }

    expect(seen.size).toBe(5); // the whole subset, page by page
  });

  // ---------- 400 - Validation ----------
  it("does not interfere with the existing query validation", async () => {
    // `area` itself never validates (issue #158, trap 5). The 400 below comes
    // from `limit` — proving the new param slots into the existing manual
    // validation without changing it.
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });

    const response = await request(app)
      .get("/activities")
      .query({ area: "Saúde", limit: 101 });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Validation error.");
    expect(response.body.errors).toEqual([
      { field: "limit", message: "limit can not exceed 100." },
    ]);
  });

  // ---------- 401 / 404: intentionally absent ----------
  // 401: the route is public — it registers no auth middleware.
  // 404: an unknown area answers 200 with an empty page (see CA3 above); the
  //      listing route itself always exists.
  // Format-level 400s for `type`/`status`/`format`/`orderBy` belong to a
  // general list-validation suite, not to the area filter.
});
