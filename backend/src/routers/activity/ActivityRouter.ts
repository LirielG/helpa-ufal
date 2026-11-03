import express from "express";
import ActivityController from "@/controllers/activity/ActivityController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";
import type { IActivityController } from "@/controllers/activity/IActivityController.js";
import type { IAuthMiddleware } from "@/middlewares/auth/IAuthMiddleware.js";
import ActivityReportController from "@/controllers/activityReport/AcitivtyReportController.js";
import { IActivityReportController } from "@/controllers/activityReport/IActivityReportController.js";
import EnrollmentController from "@/controllers/enrollment/EnrollmentController.js";
import type { IEnrollmentController } from "@/controllers/enrollment/IEnrollmentController.js";

const router = express.Router();
const activityController: IActivityController = new ActivityController();
const activityReportController: IActivityReportController =
  new ActivityReportController();
const enrollmentController: IEnrollmentController = new EnrollmentController();
const authMiddleware: IAuthMiddleware = new AuthMiddleware();

router.post("/activities", authMiddleware.requireAuth(), (req, res) =>
  activityController.create(req, res),
);

router.get("/activities", (req, res) => activityController.list(req, res));

router.get("/activities/filters", (req, res) =>
  activityController.listFilters(req, res),
);

router.get(
  "/activities/:activityId",
  authMiddleware.optionalAuth(),
  (req, res) => activityController.findById(req, res),
);

router.patch(
  "/activities/:activityId",
  authMiddleware.requireAuth(),
  (req, res) => activityController.update(req, res),
);

router.post(
  "/activities/:activityId/reports",
  authMiddleware.requireAuth(),
  (req, res) => activityReportController.createReport(req, res),
);

router.put(
  "/activities/:activityId/enrollments/me",
  authMiddleware.requireAuth(),
  (req, res) => enrollmentController.enroll(req, res),
);

router.delete(
  "/activities/:activityId/enrollments/me",
  authMiddleware.requireAuth(),
  (req, res) => enrollmentController.cancel(req, res),
);

router.put(
  "/activities/:activityId/status",
  authMiddleware.requireAuth(),
  (req, res) => activityController.updateStatus(req, res),
);

router.delete(
  "/activities/:activityId",
  authMiddleware.requireAuth(),
  (req, res) => activityController.delete(req, res),
);

export default router;
