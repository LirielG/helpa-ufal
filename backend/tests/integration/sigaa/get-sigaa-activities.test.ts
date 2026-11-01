import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "@/app.js";
import {
  createActivity,
  createSigaaActivity,
  createTeacher,
} from "../../helpers/factories.js";

describe("GET /sigaa-activities", () => {
  // ---------- 200 - OK ----------
  it("returns an empty page instead of an error when there is no activity", async () => {
    // The table is empty on every test, so this also pins down that the route
    // answers without scraping: syncIfNeeded() bails out on SIGAA_SYNC_ENABLED
    // before the TTL check, which would otherwise force a real sync here.
    const response = await request(app).get("/sigaa-activities");

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.total).toBe(0);
  });

  it("returns the stored activities with the pagination envelope", async () => {
    await createSigaaActivity({ title: "Curso de Libras" });

    const response = await request(app).get("/sigaa-activities");

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.page).toBe(1);
    expect(response.body.limit).toBe(10);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      title: "Curso de Libras",
      type: "CURSO",
      department: "CEDU",
    });
  });

  it("echoes back the requested page and limit", async () => {
    await createSigaaActivity();
    await createSigaaActivity();
    await createSigaaActivity();

    const response = await request(app)
      .get("/sigaa-activities")
      .query({ page: 2, limit: 2 });

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(2);
    expect(response.body.limit).toBe(2);
    expect(response.body.total).toBe(3);
    expect(response.body.items).toHaveLength(1);
  });

  // ---------- Pagination bounds ----------
  it("caps limit at 100 instead of letting a client ask for the whole table", async () => {
    const response = await request(app)
      .get("/sigaa-activities")
      .query({ limit: 500 });

    expect(response.status).toBe(200);
    expect(response.body.limit).toBe(100);
  });

  it("clamps a page below 1 to the first page", async () => {
    const response = await request(app)
      .get("/sigaa-activities")
      .query({ page: 0 });

    expect(response.status).toBe(200);
    expect(response.body.page).toBe(1);
  });

  // ---------- 400 - Bad Request ----------
  it("rejects an orderBy outside the sortable columns", async () => {
    const response = await request(app)
      .get("/sigaa-activities")
      .query({ orderBy: "department" });

    expect(response.status).toBe(400);
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({ field: "orderBy" }),
    );
  });

  it("rejects an order that is neither asc nor desc", async () => {
    const response = await request(app)
      .get("/sigaa-activities")
      .query({ order: "ascending" });

    expect(response.status).toBe(400);
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({ field: "order" }),
    );
  });

  // ---------- Filters ----------
  it("filters by department", async () => {
    await createSigaaActivity({ title: "Ação do CEDU", department: "CEDU" });
    await createSigaaActivity({ title: "Ação do ICAT", department: "ICAT" });

    const response = await request(app)
      .get("/sigaa-activities")
      .query({ department: "ICAT" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].title).toBe("Ação do ICAT");
  });

  it("matches the title regardless of case when searching", async () => {
    await createSigaaActivity({ title: "Curso de LIBRAS para iniciantes" });
    await createSigaaActivity({ title: "Oficina de Robótica" });

    const response = await request(app)
      .get("/sigaa-activities")
      .query({ search: "libras" });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].title).toBe(
      "Curso de LIBRAS para iniciantes",
    );
  });

  it("never lists an inactive activity", async () => {
    // markInactiveBefore flips isActive when the scraper stops seeing a row:
    // the listing must forget it, not just stop offering it as a filter.
    await createSigaaActivity({ title: "Ação ativa" });
    await createSigaaActivity({
      title: "Ação removida do SIGAA",
      isActive: false,
    });

    const unfiltered = await request(app).get("/sigaa-activities");

    expect(unfiltered.status).toBe(200);
    expect(unfiltered.body.total).toBe(1);
    expect(unfiltered.body.items[0].title).toBe("Ação ativa");

    const searched = await request(app)
      .get("/sigaa-activities")
      .query({ search: "removida" });

    expect(searched.status).toBe(200);
    expect(searched.body.items).toEqual([]);
    expect(searched.body.total).toBe(0);
  });

  // ---------- Isolation between the two sources ----------
  it("keeps the SIGAA feed and the platform feed apart", async () => {
    // The two feeds read different tables through different repositories, so
    // today they cannot mix. The assertion exists to fail loudly if someone
    // reintroduces the unified feed the team dropped.
    const author = await createTeacher();
    const platformActivity = await createActivity(author.user.id, {
      title: "Ação criada na plataforma",
    });
    const sigaaActivity = await createSigaaActivity({
      title: "Ação importada do SIGAA",
    });

    const platformFeed = await request(app).get("/activities");

    expect(platformFeed.status).toBe(200);
    expect(platformFeed.body.total).toBe(1);
    expect(platformFeed.body.activities[0].id).toBe(platformActivity.id);
    for (const activity of platformFeed.body.activities) {
      expect(activity).not.toHaveProperty("sigaaId");
    }

    const sigaaFeed = await request(app).get("/sigaa-activities");

    expect(sigaaFeed.status).toBe(200);
    expect(sigaaFeed.body.total).toBe(1);
    expect(sigaaFeed.body.items[0].id).toBe(sigaaActivity.id);
    expect(
      sigaaFeed.body.items.map((item: { title: string }) => item.title),
    ).not.toContain(platformActivity.title);
  });
});
