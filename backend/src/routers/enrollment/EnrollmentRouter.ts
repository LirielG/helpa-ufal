import express from "express";
import EnrollmentController from "@/controllers/enrollment/EnrollmentController.js";
import type { IEnrollmentController } from "@/controllers/enrollment/IEnrollmentController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";

import {
  ConfirmAttendanceBodySchema,
  ListParticipantsQuerySchema,
} from "@/schemas/enrollment/EnrollmentSchemas.js";
import { validateParams } from "@/middlewares/validation/validateParams.js";
import {
  ActivityPathParamsSchema,
  EnrollmentPathParamsSchema,
} from "@/schemas/common/PathParamsSchemas.js";

const router = express.Router();
const enrollmentController: IEnrollmentController = new EnrollmentController();
const authMiddleware = new AuthMiddleware();

router.get(
  "/activities/:activityId/enrollments",
  authMiddleware.requireAuth(),
  validateParams(ActivityPathParamsSchema, {
    query: ListParticipantsQuerySchema,
  }),
  (req, res) => enrollmentController.listParticipants(req, res),
);

router.put(
  "/enrollments/:enrollmentId/attendance",
  authMiddleware.requireAuth(),
  validateParams(EnrollmentPathParamsSchema, {
    body: ConfirmAttendanceBodySchema,
  }),
  (req, res) => enrollmentController.confirmAttendance(req, res),
);

export default router;
