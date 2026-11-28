import { describe, expect, it } from "vitest";
import { API, http, HttpResponse, makeAction, makePage, server } from "@/test";
import { fetchActions, fetchFeaturedActions } from "../services";
import type { FilterOptions } from "../types";

const NO_FILTERS: FilterOptions = {
  area: "all",
  actionType: "all",
  status: "OPEN",
};

/** Serves one action under the page metadata given. */
function serveEnvelope(metadata: Parameters<typeof makePage>[1]): void {
  server.use(
    http.get(`${API}/activities`, () =>
      HttpResponse.json(makePage([makeAction()], metadata)),
    ),
  );
}

/** Records the query string of every GET /activities. */
function captureParams(): URLSearchParams[] {
  const requests: URLSearchParams[] = [];

  server.use(
    http.get(`${API}/activities`, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json(makePage([]));
    }),
  );

  return requests;
}

describe("fetchActions", () => {
  it("sends no `status` when the default 'OPEN' filter is chosen", async () => {
    const requests = captureParams();

    await fetchActions(NO_FILTERS);

    expect(requests[0].has("status")).toBe(false);
  });

  it.each(["IN_PROGRESS", "COMPLETED", "CANCELLED", "ALL"] as const)(
    "sends `status=%s` when a non-default status filter is chosen",
    async (status) => {
      const requests = captureParams();

      await fetchActions({ ...NO_FILTERS, status });

      expect(requests[0].get("status")).toBe(status);
    },
  );

  it("sends no `area` when every area is chosen", async () => {
    const requests = captureParams();

    await fetchActions(NO_FILTERS);

    expect(requests[0].has("area")).toBe(false);
  });

  it("sends no `type` when every type is chosen", async () => {
    const requests = captureParams();

    await fetchActions(NO_FILTERS);

    expect(requests[0].has("type")).toBe(false);
  });

  it("passes on the items and the page count the API answered", async () => {
    serveEnvelope({ total: 25, page: 1, limit: 20, totalPages: 2 });

    const result = await fetchActions(NO_FILTERS, 1, 20);

    expect(result.items).toHaveLength(1);
    expect(result).toMatchObject({
      total: 25,
      page: 1,
      limit: 20,
      totalPages: 2,
    });
  });

  it("takes totalPages from the API instead of computing it", async () => {
    // 25 / 20 would give 2 pages; a client-side count cannot produce 7.
    serveEnvelope({ total: 25, page: 1, limit: 20, totalPages: 7 });

    await expect(fetchActions(NO_FILTERS, 1, 20)).resolves.toMatchObject({
      totalPages: 7,
    });
  });
});

describe("fetchFeaturedActions", () => {
  it("requests activities with default feed cutout (no status, orderBy=start_date, order=asc, limit=4)", async () => {
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(`${API}/activities`, ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json(
          makePage([makeAction({ id: "1" }), makeAction({ id: "2" })]),
        );
      }),
    );

    const items = await fetchFeaturedActions();

    expect(requests).toHaveLength(1);
    expect(requests[0].get("status")).toBeNull();
    expect(requests[0].get("orderBy")).toBe("start_date");
    expect(requests[0].get("order")).toBe("asc");
    expect(requests[0].get("limit")).toBe("4");
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe("1");
    expect(items[1].id).toBe("2");
  });
});
