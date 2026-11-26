import express from "express";
import ModerationController from "@/controllers/moderation/ModerationController.js";
import type { IModerationController } from "@/controllers/moderation/IModerationController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";
import type { IAuthMiddleware } from "@/middlewares/auth/IAuthMiddleware.js";
import { validateParams } from "@/middlewares/validation/validateParams.js";
import { validateQuery } from "@/middlewares/validation/validateQuery.js";
import { INVALID_QUERY_MESSAGE } from "@/schemas/common/PaginationSchemas.js";
import { ActivityPathParamsSchema } from "@/schemas/common/PathParamsSchemas.js";
import {
  CreateModerationDecisionSchema,
  ListReportedActivitiesQuerySchema,
} from "@/schemas/moderation/moderationSchemas.js";

const router = express.Router();
const moderationController: IModerationController = new ModerationController();
const authMiddleware: IAuthMiddleware = new AuthMiddleware();

// Validation order: 401 -> 403 (manager role) -> 400 (format) -> 404 -> 403
// (author) -> 409.
router.get(
  "/reported-activities",
  authMiddleware.requireAuth({ manager: true }),
  validateQuery(ListReportedActivitiesQuerySchema, INVALID_QUERY_MESSAGE),
  (req, res) => moderationController.listReportedActivities(req, res),
);

router.post(
  "/activities/:activityId/moderation-decisions",
  authMiddleware.requireAuth({ manager: true }),
  validateParams(ActivityPathParamsSchema, {
    body: CreateModerationDecisionSchema,
  }),
  (req, res) => moderationController.createDecision(req, res),
);

export default router;
