import { describe, expect, it } from "vitest";
import { API, http, HttpResponse, server } from "@/test/http";
import {
  makeAction,
  makeActionDetail,
  makeUserActivityItem,
} from "@/test/factories";
import { ApiError } from "@/services/apiError";
import type { UserActivityItem } from "@/services/contracts/user";
import {
  fetchUserActivities,
  updateActivityStatus,
  updateProfile,
} from "../services";

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
      description: "Descrição da ação de teste.",
      location: "Arapiraca - AL",
      action: {
        id: ACTION_ID,
        title: "Mutirão na Lagoa",
        status: "IN_PROGRESS",
      },
    });
    expect(activity.date).toMatch(/2026/);
  });

  it("falls back to the campus when the action has neither address nor details", async () => {
    serveUserActivities([
      makeUserActivityItem({ campus: "PENEDO", details: null }),
    ]);

    const [activity] = await fetchUserActivities("managed");

    expect(activity.location).toBe("UFAL - Campus Penedo");
    expect(activity.description).toBe("Sem descrição informada.");
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

describe("updateProfile", () => {
  it("sends the body as a PATCH to /users/me and returns the saved profile", async () => {
    let request: { method: string; body: unknown } | undefined;
    server.use(
      http.patch(`${API}/users/me`, async ({ request: req }) => {
        request = { method: req.method, body: await req.json() };
        return HttpResponse.json({
          fullName: "Nome Salvo",
          totalWorkloadHours: 0,
        });
      }),
    );

    const profile = await updateProfile({ fullName: "Nome Salvo" });

    expect(request).toEqual({
      method: "PATCH",
      body: { fullName: "Nome Salvo" },
    });
    expect(profile).toMatchObject({ fullName: "Nome Salvo" });
  });

  it("rejects with the API's field errors so the form can place them", async () => {
    const errors = [{ field: "fullName", message: "Too big" }];
    server.use(
      http.patch(`${API}/users/me`, () =>
        HttpResponse.json(
          { status: 400, message: "Validation error.", errors },
          { status: 400 },
        ),
      ),
    );

    const error = await updateProfile({ fullName: "x" }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, errors });
  });
});
