import { describe, it, expect } from "vitest";
import { ApiError } from "@/services/apiError";
import { http, HttpResponse, server } from "@/test/http";
import { makeEnrollment } from "@/test/factories";
import { fetchEnrollments } from "../services";

const API = process.env.VITE_API_URL || "http://localhost:3333/api";

describe("fetchEnrollments", () => {
  it("requests the activity's enrollments with page and limit", async () => {
    let requestedUrl: URL | undefined;

    server.use(
      http.get(`${API}/activities/act-1/enrollments`, ({ request }) => {
        requestedUrl = new URL(request.url);
        return HttpResponse.json({
          items: [makeEnrollment()],
          total: 1,
          page: 2,
          limit: 10,
          totalPresent: 0,
        });
      }),
    );

    const result = await fetchEnrollments("act-1", 2, 10);

    expect(requestedUrl?.searchParams.get("page")).toBe("2");
    expect(requestedUrl?.searchParams.get("limit")).toBe("10");
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it("rejects with ApiError carrying the status on failure", async () => {
    server.use(
      http.get(`${API}/activities/act-1/enrollments`, () =>
        HttpResponse.json({ message: "Forbidden" }, { status: 403 }),
      ),
    );

    await expect(fetchEnrollments("act-1")).rejects.toMatchObject({
      status: 403,
    });
    await expect(fetchEnrollments("act-1")).rejects.toBeInstanceOf(ApiError);
  });
});
