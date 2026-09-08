import { describe, it, expect } from "vitest"; // globals are disabled: explicit import
import request from "supertest";
import { app } from "@/app.js";
import { createSigaaActivity } from "../../helpers/factories.js";

describe("GET /sigaa-activities/filters", () => {
  // ---------- 200 - OK ----------
  it("returns empty lists instead of an error when there is no activity", async () => {
    const response = await request(app).get("/sigaa-activities/filters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ types: [], departments: [] });
  });

  it("sorts both lists alphabetically and reports each value once", async () => {
    await createSigaaActivity({ type: "PROJETO", department: "ICAT" });
    await createSigaaActivity({ type: "CURSO", department: "CEDU" });
    await createSigaaActivity({ type: "CURSO", department: "CEDU" });
    await createSigaaActivity({ type: "EVENTO", department: "FDA" });

    const response = await request(app).get("/sigaa-activities/filters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      types: ["CURSO", "EVENTO", "PROJETO"],
      departments: ["CEDU", "FDA", "ICAT"],
    });
  });

  it("omits values that only exist in inactive activities", async () => {
    // markInactiveBefore flips isActive when the scraper stops seeing a row:
    // offering a filter that matches nothing would be a dead end in the UI.
    await createSigaaActivity({ type: "CURSO", department: "CEDU" });
    await createSigaaActivity({
      type: "PRESTAÇÃO DE SERVIÇOS",
      department: "FANUT",
      isActive: false,
    });

    const response = await request(app).get("/sigaa-activities/filters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ types: ["CURSO"], departments: ["CEDU"] });
  });

  it("skips activities with no department without dropping their type", async () => {
    await createSigaaActivity({ type: "PROGRAMA", department: null });

    const response = await request(app).get("/sigaa-activities/filters");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ types: ["PROGRAMA"], departments: [] });
  });

  // ---------- Coherence with the listing filters ----------
  it("returns results for every value it announces", async () => {
    await createSigaaActivity({ type: "CURSO", department: "CEDU" });
    await createSigaaActivity({
      type: "PRESTAÇÃO DE SERVIÇOS",
      department: "FANUT",
    });

    await createSigaaActivity({
      type: "AÇÃO CURRICULAR DE EXTENSÃO",
      department: "ICAT",
    });

    const options = await request(app)
      .get("/sigaa-activities/filters")
      .expect(200);

    for (const type of options.body.types) {
      const listed = await request(app)
        .get("/sigaa-activities")
        .query({ type });

      expect(listed.status).toBe(200);
      expect(listed.body.total).toBeGreaterThan(0);
    }

    for (const department of options.body.departments) {
      const listed = await request(app)
        .get("/sigaa-activities")
        .query({ department });

      expect(listed.status).toBe(200);
      expect(listed.body.total).toBeGreaterThan(0);
    }
  });

  it("answers an unknown type with an empty page instead of a validation error", async () => {
    // Guards against reintroducing a hardcoded type whitelist: `type` mirrors a
    // column the scraper fills, so it behaves like `department` already did.
    await createSigaaActivity({ type: "CURSO" });

    const response = await request(app)
      .get("/sigaa-activities")
      .query({ type: "TIPO QUE NÃO EXISTE" });

    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(response.body.total).toBe(0);
  });
});
