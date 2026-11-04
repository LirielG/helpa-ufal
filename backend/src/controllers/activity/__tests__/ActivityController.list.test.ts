import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import ActivityController from "../ActivityController.js";
import type { IActivityService } from "@/services/activity/IActivityService.js";
import type { AuthenticatedUser } from "@/types/auth.js";

describe("ActivityController.list", () => {
  it.each([
    { session: "anonymous", user: undefined },
    {
      session: "authenticated",
      user: {
        id: "user-1",
        userType: "STUDENT",
        isManager: false,
        tokenVersion: 0,
      } satisfies AuthenticatedUser,
    },
  ])(
    "lists activities using only filters for an $session request",
    async ({ user }) => {
      const filters = { area: "Saúde", page: "2", limit: "5" };
      const result = { activities: [], total: 0 };
      const list = vi.fn().mockResolvedValue(result);
      const activityService = { list } as unknown as IActivityService;
      const controller = new ActivityController({ activityService });
      const req = { query: filters, user } as unknown as Request;
      const res = { status: vi.fn(), json: vi.fn() };
      res.status.mockReturnValue(res);

      await controller.list(req, res as unknown as Response);

      expect(list).toHaveBeenCalledWith(filters);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
    },
  );
});
