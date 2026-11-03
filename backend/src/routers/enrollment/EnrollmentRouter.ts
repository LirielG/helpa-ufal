import express from "express";
import EnrollmentController from "@/controllers/enrollment/EnrollmentController.js";
import type { IEnrollmentController } from "@/controllers/enrollment/IEnrollmentController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";

import { ListParticipantsQuerySchema } from "@/schemas/enrollment/EnrollmentSchemas.js";
import { INVALID_QUERY_MESSAGE } from "@/schemas/common/PaginationSchemas.js";
import { validateQuery } from "@/middlewares/validation/validateQuery.js";

const router = express.Router();
const enrollmentController: IEnrollmentController = new EnrollmentController();
const authMiddleware = new AuthMiddleware();

/**
 * GET /activities/:activityId/enrollments — enrollment list for the creator/manager.
 *
 * Authentication precedes query validation so an expired session reaches
 * the client's 401 handling even when the query is invalid. Existence (404)
 * and authorization (403) are checked in the service.
 */
router.get(
  "/activities/:activityId/enrollments",
  authMiddleware.requireAuth(),
  validateQuery(ListParticipantsQuerySchema, INVALID_QUERY_MESSAGE),
  (req, res) => enrollmentController.listParticipants(req, res),
);

router.put(
  "/enrollments/:enrollmentId/attendance",
  authMiddleware.requireAuth(),
  (req, res) => enrollmentController.confirmAttendance(req, res),
);

export default router;
