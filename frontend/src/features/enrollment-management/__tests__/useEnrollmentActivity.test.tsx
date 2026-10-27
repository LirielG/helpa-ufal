import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { API, http, HttpResponse, makeActionDetail, server } from "@/test";
import { useEnrollmentActivity } from "../useEnrollmentActivity";

describe("useEnrollmentActivity", () => {
  it("exposes the activity the enrollments belong to", async () => {
    server.use(
      http.get(`${API}/activities/:id`, ({ params }) =>
        HttpResponse.json(
          makeActionDetail({
            id: String(params.id),
            slots: 10,
            availableSlots: 4,
            status: "COMPLETED",
          }),
        ),
      ),
    );

    const { result } = renderHook(() => useEnrollmentActivity("act-1"));

    expect(result.current.activity).toBeNull();

    await waitFor(() => expect(result.current.activity?.slots).toBe(10));
    expect(result.current.activity?.availableSlots).toBe(4);
    expect(result.current.activity?.status).toBe("COMPLETED");
  });

  it("fetches the activity again on reload", async () => {
    let status: "COMPLETED" | "IN_PROGRESS" = "COMPLETED";

    server.use(
      http.get(`${API}/activities/:id`, () =>
        HttpResponse.json(makeActionDetail({ id: "act-1", status })),
      ),
    );

    const { result } = renderHook(() => useEnrollmentActivity("act-1"));

    await waitFor(() =>
      expect(result.current.activity?.status).toBe("COMPLETED"),
    );

    status = "IN_PROGRESS";
    act(() => result.current.reload());

    await waitFor(() =>
      expect(result.current.activity?.status).toBe("IN_PROGRESS"),
    );
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

    const { result, rerender } = renderHook(
      ({ id }) => useEnrollmentActivity(id),
      { initialProps: { id: "act-a" } },
    );

    rerender({ id: "act-b" });

    await waitFor(() => expect(result.current.activity?.slots).toBe(5));

    await act(async () => {
      releaseA();
      await activityA;
    });

    expect(result.current.activity?.slots).toBe(5);
    expect(result.current.activity?.availableSlots).toBe(1);
  });

  it.each([0, 404, 500])(
    "keeps the loaded activity when a reload fails with %s",
    async (status) => {
      let fail = false;

      server.use(
        http.get(`${API}/activities/:id`, () =>
          fail
            ? status === 0
              ? HttpResponse.error()
              : new HttpResponse(null, { status })
            : HttpResponse.json(
                makeActionDetail({ id: "act-1", status: "COMPLETED" }),
              ),
        ),
      );

      const { result } = renderHook(() => useEnrollmentActivity("act-1"));
      await waitFor(() =>
        expect(result.current.activity?.status).toBe("COMPLETED"),
      );

      fail = true;
      await act(async () => {
        result.current.reload();
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      expect(result.current.activity?.status).toBe("COMPLETED");
    },
  );

  it("does not expose the previous activity while the next one loads", async () => {
    server.use(
      http.get(`${API}/activities/:id`, async ({ params }) => {
        if (params.id === "act-b") await new Promise(() => {});
        return HttpResponse.json(
          makeActionDetail({ id: String(params.id), status: "COMPLETED" }),
        );
      }),
    );

    const { result, rerender } = renderHook(
      ({ id }) => useEnrollmentActivity(id),
      { initialProps: { id: "act-a" } },
    );
    await waitFor(() => expect(result.current.activity?.id).toBe("act-a"));

    rerender({ id: "act-b" });

    expect(result.current.activity).toBeNull();
  });
});
