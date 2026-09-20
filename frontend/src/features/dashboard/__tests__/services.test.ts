import { describe, expect, it } from "vitest";
import { API, http, HttpResponse, makeAction, server } from "@/test";
import { fetchActions } from "../services";
import type { FilterOptions } from "../types";

const NO_FILTERS: FilterOptions = {
  area: "all",
  actionType: "all",
  availability: "all",
};

/** GET /activities answers with the slice and the overall count, nothing else. */
function serveTotal(total: number): void {
  server.use(
    http.get(`${API}/activities`, () =>
      HttpResponse.json({
        activities: total > 0 ? [makeAction()] : [],
        total,
      }),
    ),
  );
}

describe("fetchActions", () => {
  it("derives totalPages from the total and the limit it sent", async () => {
    serveTotal(25);

    await expect(fetchActions(NO_FILTERS, 1, 20)).resolves.toMatchObject({
      total: 25,
      totalPages: 2,
    });
  });

  it("follows the limit the caller chose, not a fixed one", async () => {
    serveTotal(25);

    await expect(fetchActions(NO_FILTERS, 1, 10)).resolves.toMatchObject({
      totalPages: 3,
    });
  });

  it("adds no trailing page when the total fills the last one exactly", async () => {
    serveTotal(40);

    await expect(fetchActions(NO_FILTERS, 1, 20)).resolves.toMatchObject({
      totalPages: 2,
    });
  });

  it("keeps one page when the API returns no actions", async () => {
    serveTotal(0);

    await expect(fetchActions(NO_FILTERS, 1, 20)).resolves.toMatchObject({
      total: 0,
      totalPages: 1,
    });
  });
});
