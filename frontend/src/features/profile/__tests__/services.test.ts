import { describe, expect, it } from "vitest";
import { API, http, HttpResponse, server } from "@/test/http";
import { makeAction } from "@/test/factories";
import { ApiError } from "@/services/apiError";
import { updateActivityStatus } from "../services";

const ACTION_ID = "act-status";

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
