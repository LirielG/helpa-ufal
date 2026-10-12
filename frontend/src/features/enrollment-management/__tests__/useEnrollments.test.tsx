import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse, server } from "@/test/http";
import { makeEnrollment } from "@/test/factories";
import { useEnrollments } from "../useEnrollments";

const API = process.env.VITE_API_URL || "http://localhost:3333/api";

/** A promise the test settles by hand, to control when a response arrives. */
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function listOf(name: string, page: number) {
  return HttpResponse.json({
    items: [makeEnrollment({ fullName: name })],
    total: 25,
    page,
    limit: 20,
    totalPresent: 0,
  });
}

describe("useEnrollments", () => {
  it("ignores a late response for an earlier page", async () => {
    const page2 = deferred();
    let page1Calls = 0;

    server.use(
      http.get(`${API}/activities/:id/enrollments`, async ({ request }) => {
        const page = new URL(request.url).searchParams.get("page");

        if (page === "2") {
          await page2.promise;
          return listOf("Pessoa da página 2", 2);
        }

        page1Calls += 1;
        return listOf(page1Calls === 1 ? "Primeira carga" : "Voltei à 1", 1);
      }),
    );

    const { result } = renderHook(() => useEnrollments("act-1"));

    await waitFor(() =>
      expect(result.current.data?.items[0]?.fullName).toBe("Primeira carga"),
    );

    // Ask for page 2, which hangs, then change our mind and go back to page 1.
    act(() => {
      void result.current.goToPage(2);
    });
    await act(async () => {
      await result.current.goToPage(1);
    });

    expect(result.current.data?.items[0]?.fullName).toBe("Voltei à 1");

    // Page 2 finally answers, after it was abandoned.
    await act(async () => {
      page2.release();
      await page2.promise;
    });

    expect(result.current.data?.items[0]?.fullName).toBe("Voltei à 1");
    expect(result.current.page).toBe(1);
    expect(result.current.isLoading).toBe(false);
  });

  it("ignores the previous activity's response after the activity changes", async () => {
    const activityA = deferred();

    server.use(
      http.get(`${API}/activities/:id/enrollments`, async ({ params }) => {
        if (params.id === "act-a") {
          await activityA.promise;
          return listOf("Inscrito da A", 1);
        }

        return listOf("Inscrito da B", 1);
      }),
    );

    const { result, rerender } = renderHook(
      ({ id }) => useEnrollments(id),
      { initialProps: { id: "act-a" } },
    );

    rerender({ id: "act-b" });

    await waitFor(() =>
      expect(result.current.data?.items[0]?.fullName).toBe("Inscrito da B"),
    );

    await act(async () => {
      activityA.release();
      await activityA.promise;
    });

    expect(result.current.data?.items[0]?.fullName).toBe("Inscrito da B");
  });
});

