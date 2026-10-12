import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { API, http, HttpResponse, makeActionDetail, server } from "@/test";
import { useActionSlots } from "../useActionSlots";


describe("useActionSlots", () => {
  it("exposes the slot counts of the activity", async () => {
    server.use(
      http.get(`${API}/activities/:id`, ({ params }) =>
        HttpResponse.json(
          makeActionDetail({
            id: String(params.id),
            slots: 10,
            availableSlots: 4,
          }),
        ),
      ),
    );

    const { result } = renderHook(() => useActionSlots("act-1"));

    expect(result.current.slots).toBeNull();

    await waitFor(() => expect(result.current.slots).toBe(10));
    expect(result.current.availableSlots).toBe(4);
  });

  it("ignores the previous activity's response after the activity changes", async () => {
    let releaseA!: () => void;
    const activityA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    server.use(
      http.get(`${API}/activities/:id`, async ({ params }) => {
        if (params.id === "act-a") {
          await activityA;
          return HttpResponse.json(
            makeActionDetail({ id: "act-a", slots: 99, availableSlots: 99 }),
          );
        }

        return HttpResponse.json(
          makeActionDetail({ id: "act-b", slots: 5, availableSlots: 1 }),
        );
      }),
    );

    const { result, rerender } = renderHook(({ id }) => useActionSlots(id), {
      initialProps: { id: "act-a" },
    });

    rerender({ id: "act-b" });

    await waitFor(() => expect(result.current.slots).toBe(5));

    await act(async () => {
      releaseA();
      await activityA;
    });

    expect(result.current.slots).toBe(5);
    expect(result.current.availableSlots).toBe(1);
  });
});

