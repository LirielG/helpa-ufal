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
 * Middleware order IS the contract (docs/bruno/Enrollments/List Activity
 * Enrollments.yml): query format (400) -> auth (401) -> activity existence
 * (404) -> authorization (403). The last two live in the service.
 *
 * auth() has no effect without options — `userTypes: "all"` is what actually
 * requires a credential here (cookie session).
 */
router.get(
  "/activities/:activityId/enrollments",
  validateQuery(ListParticipantsQuerySchema, INVALID_QUERY_MESSAGE),
  authMiddleware.auth({ userTypes: "all" }),
  (req, res) => enrollmentController.listParticipants(req, res),
);

router.put(
  "/enrollments/:enrollmentId/attendance",
  authMiddleware.auth({ userTypes: "all" }),
  (req, res) => enrollmentController.confirmAttendance(req, res),
);

export default router;
