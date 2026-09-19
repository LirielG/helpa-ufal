// backend/tests/integration/activity/get-filters.test.ts
//
// Executable spec for GET /activities/filters (#158, step 2). Written BEFORE the
// route exists (TDD): the expected initial failure is the Express default 404,
// and the exact `toEqual` assertions keep that red honest.
//
// Assumes the factory `createActivity` accepts `deletedAt` in its overrides
// (step 2, first commit — one-line change to ActivityOverrides). `area` and
// `status` were already supported.
//
// Verified against the real code (02/09): the public listing shape is
// `{ activities, total }` — not `items` — and list items carry `details.area`.

import { describe, it, expect } from "vitest"; // globals are disabled: explicit import
import request from "supertest";
import { app } from "@/app.js";
import { createTeacher, createActivity } from "../../helpers/factories.js";


describe("GET /activities/filters", () => {
  // ---------- 200 - OK ----------
  it("returns an empty list instead of an error when there is no eligible activity", async () => {
    const response = await request(app).get("/activities/filters");


    expect(response.status).toBe(200);
    expect(response.body).toEqual({ areas: [] });
  });


  it("reports each area once, sorts alphabetically and answers with the exact contract shape", async () => {
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Zoologia" });
    await createActivity(author.id, { area: "Arquitetura" });
    await createActivity(author.id, { area: "Zoologia" });
    await createActivity(author.id, { area: "Medicina" });


    const response = await request(app).get("/activities/filters");


    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      areas: ["Arquitetura", "Medicina", "Zoologia"],
    });
  });


  it("is public: answers without an Authorization header", async () => {
    // Same posture as GET /activities, which registers no auth middleware.
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });


    const response = await request(app).get("/activities/filters");


    expect(response.status).toBe(200);
    expect(response.body).toEqual({ areas: ["Saúde"] });
  });


  it("is not captured by GET /activities/:id", async () => {
    // The route must be registered BEFORE /activities/:id; "filters" is not a
    // UUID, so a wrong registration order surfaces here as a 404.
    const response = await request(app).get("/activities/filters");


    expect(response.status).not.toBe(404);
    expect(response.body).toHaveProperty("areas");
  });


  // ---------- Case handling ----------
  it("merges values that differ only by letter case into a single option", async () => {
    // The listing filter matches case-insensitively, so one canonical option
    // per case-group keeps the announced value coherent with `?area=`.
    // Which casing is canonical is a repository detail (stable per database,
    // collation-dependent across environments): the test pins the behaviour,
    // not the spelling.
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });
    await createActivity(author.id, { area: "SAÚDE" });
    await createActivity(author.id, { area: "saúde" });


    const response = await request(app).get("/activities/filters");


    expect(response.status).toBe(200);
    expect(response.body.areas).toHaveLength(1);
    expect(response.body.areas[0].toLowerCase()).toBe("saúde");
  });


  it("keeps values that differ by accents as separate options", async () => {
    // Known limitation (normalization follow-up issue): the database cannot
    // fold accents without unaccent/a normalized column. This test locks the
    // current behaviour so the limitation stays explicit, not accidental.
    // Ordering between accent variants is collation-dependent: compared as a set.
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saude" });
    await createActivity(author.id, { area: "Saúde" });


    const response = await request(app).get("/activities/filters");


    expect(response.status).toBe(200);
    expect(response.body.areas).toHaveLength(2);
    expect(response.body.areas).toEqual(
      expect.arrayContaining(["Saude", "Saúde"]),
    );
  });


  // ---------- Eligibility: soft delete and CANCELLED ----------
  it("omits areas that only exist in soft-deleted activities", async () => {
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });
    await createActivity(author.id, {
      area: "Veterinária",
      deletedAt: new Date(),
    });


    const response = await request(app).get("/activities/filters");


    expect(response.status).toBe(200);
    expect(response.body).toEqual({ areas: ["Saúde"] });
  });


  it("keeps an area present in both a soft-deleted and an eligible activity", async () => {
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });
    await createActivity(author.id, {
      area: "Saúde",
      deletedAt: new Date(),
    });


    const response = await request(app).get("/activities/filters");


    expect(response.status).toBe(200);
    expect(response.body).toEqual({ areas: ["Saúde"] });
  });


  it("omits areas that only exist in CANCELLED activities", async () => {
    // Product decision (#158): the filter is a discovery tool — announcing an
    // area whose only activities were cancelled leads to a dead end in the UI.
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });
    await createActivity(author.id, {
      area: "Computação",
      status: "CANCELLED", // two Ls: CANCELED does not exist in the enum
    });


    const response = await request(app).get("/activities/filters");


    expect(response.status).toBe(200);
    expect(response.body).toEqual({ areas: ["Saúde"] });
  });


  it("keeps an area present in both a CANCELLED and an eligible activity", async () => {
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });
    await createActivity(author.id, { area: "Saúde", status: "CANCELLED" });


    const response = await request(app).get("/activities/filters");


    expect(response.status).toBe(200);
    expect(response.body).toEqual({ areas: ["Saúde"] });
  });


  it("evaluates eligibility before case-merging", async () => {
    // "Saúde" only on a CANCELLED row, "saúde" on an OPEN one: the group is
    // announced because the eligible member qualifies — the cancelled row
    // must not drag the whole case-group out of the options.
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde", status: "CANCELLED" });
    await createActivity(author.id, { area: "saúde" });


    const response = await request(app).get("/activities/filters");


    expect(response.status).toBe(200);
    expect(response.body.areas).toHaveLength(1);
    expect(response.body.areas[0].toLowerCase()).toBe("saúde");
  });


  // ---------- Coherence with the listing filter ----------
  it("returns exactly the activities of every announced area", async () => {
    // Depends on #158 step 1 (the `area` listing filter): this stays red until
    // BOTH the route and the filter exist on the branch — expected, do not
    // "fix" it during step 3.
    //
    // The assertion is exact on purpose: today `?area=` is silently ignored
    // and the listing comes back unfiltered, so a weak `total > 0` check (as
    // the SIGAA suite uses, where the filter works) would false-pass here.
    const { user: author } = await createTeacher();
    await createActivity(author.id, { area: "Saúde" });
    await createActivity(author.id, { area: "saúde" });
    await createActivity(author.id, { area: "Educação" });


    const options = await request(app).get("/activities/filters").expect(200);


    // Case-insensitive filter: both "Saúde" spellings match either announcement.
    const expectedTotalByArea: Record<string, number> = {
      saúde: 2,
      educação: 1,
    };


    for (const area of options.body.areas) {
      const listed = await request(app)
        .get("/activities")
        .query({ area });


      expect(listed.status).toBe(200);
      expect(listed.body.total).toBe(expectedTotalByArea[area.toLowerCase()]);


      // The listing includes the raw `details` relation; area is nested.
      for (const item of listed.body.activities) {
        expect(item.details.area.toLowerCase()).toBe(area.toLowerCase());
      }
    }
  });
});
