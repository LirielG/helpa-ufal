import { describe, it, expect } from "vitest";
import { http, HttpResponse, server } from "@/test/http";
import { cancelEnrollment, enrollInAction } from "../services";

const API = process.env.VITE_API_URL || "http://localhost:3333/api";

describe("enrollInAction", () => {
  describe("success", () => {
    it("makes a PUT request to /activities/:id/enrollments/me", async () => {
      const actionId = "act-123";
      server.use(
        http.put(
          `${API}/activities/${actionId}/enrollments/me`,
          () => new HttpResponse(null, { status: 201 }),
        ),
      );

      await expect(enrollInAction(actionId)).resolves.toBeUndefined();
    });

    it.each([201, 200])(
      "resolves with a canonical %i response",
      async (status) => {
        const actionId = "act-456";
        server.use(
          http.put(`${API}/activities/${actionId}/enrollments/me`, () =>
            HttpResponse.json(
              {
                id: "enr-1",
                activityId: actionId,
                userId: "user-1",
                status: "APPROVED",
                attendanceConfirmed: null,
                confirmedWorkloadHours: 0,
                createdAt: "2026-09-11T00:00:00.000Z",
                updatedAt: "2026-09-11T00:00:00.000Z",
              },
              { status },
            ),
          ),
        );

        await expect(enrollInAction(actionId)).resolves.toBeUndefined();
      },
    );
  });

  describe("error handling", () => {
    it("rejects with ApiError on 409 conflict", async () => {
      const actionId = "act-789";
      server.use(
        http.put(`${API}/activities/${actionId}/enrollments/me`, () =>
          HttpResponse.json(
            { message: "No available slots for this activity." },
            { status: 409 },
          ),
        ),
      );

      await expect(enrollInAction(actionId)).rejects.toMatchObject({
        status: 409,
        message: expect.stringContaining("No available slots"),
      });
    });

    it("rejects with ApiError on 404 activity not found", async () => {
      const actionId = "act-invalid";
      server.use(
        http.put(`${API}/activities/${actionId}/enrollments/me`, () =>
          HttpResponse.json(
            { message: "Activity not found." },
            { status: 404 },
          ),
        ),
      );

      await expect(enrollInAction(actionId)).rejects.toMatchObject({
        status: 404,
      });
    });

    it("rejects with ApiError on 401 unauthorized", async () => {
      const actionId = "act-401";
      server.use(
        http.put(`${API}/activities/${actionId}/enrollments/me`, () =>
          HttpResponse.json({ message: "No token provided." }, { status: 401 }),
        ),
      );

      await expect(enrollInAction(actionId)).rejects.toMatchObject({
        status: 401,
      });
    });

    it("rejects with ApiError on network error", async () => {
      const actionId = "act-network";
      server.use(
        http.put(`${API}/activities/${actionId}/enrollments/me`, () =>
          HttpResponse.error(),
        ),
      );

      await expect(enrollInAction(actionId)).rejects.toMatchObject({
        status: 0,
      });
    });
  });
});

describe("cancelEnrollment", () => {
  it("sends DELETE /activities/:id/enrollments/me and resolves on 204", async () => {
    const actionId = "act-cancel";
    let calls = 0;
    server.use(
      http.delete(`${API}/activities/${actionId}/enrollments/me`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(cancelEnrollment(actionId)).resolves.toBeUndefined();
    expect(calls).toBe(1);
  });

  it("rejects with ApiError carrying the status and message", async () => {
    const actionId = "act-cancel-409";
    server.use(
      http.delete(`${API}/activities/${actionId}/enrollments/me`, () =>
        HttpResponse.json(
          { message: "Activity is not open for cancellation." },
          { status: 409 },
        ),
      ),
    );

    await expect(cancelEnrollment(actionId)).rejects.toMatchObject({
      status: 409,
      message: "Activity is not open for cancellation.",
    });
  });
});
