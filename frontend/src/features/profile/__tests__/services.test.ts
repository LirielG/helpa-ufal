import { describe, expect, it } from "vitest";
import { API, http, HttpResponse, server } from "@/test/http";
import {
  makeAction,
  makeActionDetail,
  makeUserActivityItem,
} from "@/test/factories";
import { ApiError } from "@/services/apiError";
import type { UserActivityItem } from "@/services/contracts/user";
import { fetchUserActivities, updateActivityStatus } from "../services";

const ACTION_ID = "act-status";

function serveUserActivities(items: UserActivityItem[]) {
  let url: URL | undefined;
  server.use(
    http.get(`${API}/users/me/activities`, ({ request }) => {
      url = new URL(request.url);
      return HttpResponse.json({
        items,
        total: items.length,
        page: 1,
        limit: 100,
        totalPages: 1,
      });
    }),
  );
  return () => url;
}

describe("fetchUserActivities", () => {
  it.each(["enrolled", "completed", "managed"] as const)(
    "asks the history route for the %s filter",
    async (filter) => {
      const requestedUrl = serveUserActivities([]);

      await fetchUserActivities(filter);

      expect(requestedUrl()?.searchParams.get("filter")).toBe(filter);
    },
  );

  it("maps each item to the card model, keeping the action for the modals", async () => {
    const action = makeActionDetail({
      id: ACTION_ID,
      title: "Mutirão na Lagoa",
      status: "IN_PROGRESS",
      startDate: "2026-08-20T14:00:00.000Z",
    });
    const item = makeUserActivityItem({ ...action });
    serveUserActivities([item]);

    const [activity] = await fetchUserActivities("enrolled");

    expect(activity).toMatchObject({
      id: ACTION_ID,
      title: "Mutirão na Lagoa",
      description: "Descrição da ação de teste.",
      location: "Arapiraca - AL",
      status: "enrolled",
      activityStatus: "IN_PROGRESS",
      workloadHours: 20,
    });
    expect(activity.date).toMatch(/2026/);
    expect(activity.action).toMatchObject({
      id: ACTION_ID,
      status: "IN_PROGRESS",
    });
  });

  it("falls back to the campus when the action has neither address nor details", async () => {
    serveUserActivities([
      makeUserActivityItem({ campus: "PENEDO", details: null }),
    ]);

    const [activity] = await fetchUserActivities("managed");

    expect(activity.location).toBe("UFAL - Campus Penedo");
    expect(activity.description).toBe("Sem descrição informada.");
    expect(activity.workloadHours).toBeUndefined();
  });

  it("rejects with an ApiError so the list can show its loading error", async () => {
    server.use(
      http.get(`${API}/users/me/activities`, () =>
        HttpResponse.json(
          { status: 500, message: "Internal server error." },
          { status: 500 },
        ),
      ),
    );

    await expect(fetchUserActivities("managed")).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe("updateActivityStatus", () => {
  it("sends PATCH /activities/:id/status with only the status in the body", async () => {
    let method: string | undefined;
    let body: unknown;
    server.use(
      http.patch(
        `${API}/activities/${ACTION_ID}/status`,
        async ({ request }) => {
          method = request.method;
          body = await request.json();
          return HttpResponse.json(
            makeAction({ id: ACTION_ID, status: "IN_PROGRESS" }),
          );
        },
      ),
    );

    await updateActivityStatus(ACTION_ID, "IN_PROGRESS");

    expect(method).toBe("PATCH");
    // The schema is .strict(): any extra key turns the request into a 400.
    expect(body).toStrictEqual({ status: "IN_PROGRESS" });
  });

  it("resolves with the updated action, including the recalculated slots", async () => {
    const updated = makeAction({
      id: ACTION_ID,
      status: "COMPLETED",
      availableSlots: 4,
    });
    server.use(
      http.patch(`${API}/activities/${ACTION_ID}/status`, () =>
        HttpResponse.json(updated),
      ),
    );

    await expect(
      updateActivityStatus(ACTION_ID, "COMPLETED"),
    ).resolves.toStrictEqual(updated);
  });

  it.each([
    [403, "Forbidden. Requester is not the author or a manager."],
    [404, "Activity not found."],
    [409, "Cannot transition from OPEN to COMPLETED."],
  ])(
    "rejects with an ApiError carrying the %i status",
    async (status, message) => {
      server.use(
        http.patch(`${API}/activities/${ACTION_ID}/status`, () =>
          HttpResponse.json({ status, message }, { status }),
        ),
      );

      const error = await updateActivityStatus(ACTION_ID, "COMPLETED").catch(
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status, message });
    },
  );
});
