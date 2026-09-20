import { describe, it, expect } from "vitest";
import { http, HttpResponse, server } from "@/test/http";
import { enrollInAction } from "../services";

const API = process.env.VITE_API_URL || "http://localhost:3333/api";

describe("enrollInAction", () => {
  describe("success", () => {
    it("makes a POST request to /activities/:id/enroll", async () => {
      const actionId = "act-123";
      server.use(
        http.post(
          `${API}/activities/${actionId}/enroll`,
          () => new HttpResponse(null, { status: 201 }),
        ),
      );

      await expect(enrollInAction(actionId)).resolves.toBeUndefined();
    });

    it("resolves with 201 response", async () => {
      const actionId = "act-456";
      server.use(
        http.post(`${API}/activities/${actionId}/enroll`, () =>
          HttpResponse.json(
            {
              id: "enr-1",
              activityId: actionId,
              userId: "user-1",
              createdAt: "2026-09-11T00:00:00Z",
            },
            { status: 201 },
          ),
        ),
      );

      await expect(enrollInAction(actionId)).resolves.toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("rejects with ApiError on 409 conflict", async () => {
      const actionId = "act-789";
      server.use(
        http.post(`${API}/activities/${actionId}/enroll`, () =>
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
        http.post(`${API}/activities/${actionId}/enroll`, () =>
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
        http.post(`${API}/activities/${actionId}/enroll`, () =>
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
        http.post(`${API}/activities/${actionId}/enroll`, () =>
          HttpResponse.error(),
        ),
      );

      await expect(enrollInAction(actionId)).rejects.toMatchObject({
        status: 0,
      });
    });
  });
});
