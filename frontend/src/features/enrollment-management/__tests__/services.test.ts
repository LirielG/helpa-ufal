import { describe, it, expect } from "vitest";
import { ApiError } from "@/services/apiError";
import { API, http, HttpResponse, makeEnrollment, server } from "@/test";
import { confirmAttendance, fetchEnrollments } from "../services";


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

describe("confirmAttendance", () => {
  it("puts the presence with its hours on the enrollment's own route", async () => {
    const requests: Request[] = [];
    const updated = makeEnrollment({
      id: "enr-1",
      attendanceConfirmed: true,
      confirmedWorkloadHours: 4,
    });

    server.use(
      http.put(`${API}/enrollments/enr-1/attendance`, ({ request }) => {
        requests.push(request.clone());
        return HttpResponse.json(updated);
      }),
    );

    const result = await confirmAttendance("enr-1", {
      attended: true,
      workloadHours: 4,
    });

    expect(requests).toHaveLength(1);
    await expect(requests[0].json()).resolves.toEqual({
      attended: true,
      workloadHours: 4,
    });
    expect(result.confirmedWorkloadHours).toBe(4);
  });

  it("sends an absence without workloadHours", async () => {
    const requests: Request[] = [];

    server.use(
      http.put(`${API}/enrollments/enr-1/attendance`, ({ request }) => {
        requests.push(request.clone());
        return HttpResponse.json(
          makeEnrollment({ id: "enr-1", attendanceConfirmed: false }),
        );
      }),
    );

    await confirmAttendance("enr-1", { attended: false });

    await expect(requests[0].json()).resolves.toEqual({ attended: false });
  });
});
