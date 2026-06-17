import express from "express";
import ActivityController from "@/controllers/activity/ActivityController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";
import type { IActivityController } from "@/controllers/activity/IActivityController.js";
import type { IAuthMiddleware } from "@/middlewares/auth/IAuthMiddleware.js";
import ActivityReportController from "@/controllers/activityReport/AcitivtyReportController.js";
import { IActivityReportController } from "@/controllers/activityReport/IActivityReportController.js";

const router = express.Router();
const activityController: IActivityController = new ActivityController();
const activityReportController: IActivityReportController = new ActivityReportController();
const authMiddleware: IAuthMiddleware = new AuthMiddleware();

router.post(
  "/activities",
  authMiddleware.auth(),
  (req, res, next) => activityController.create(req, res).catch(next),
);

router.get(
  "/activities",
  (req, res, next) => activityController.list(req, res).catch(next),
);

router.get(
  "/activities/:id",
  (req, res, next) => activityController.findById(req, res).catch(next),
);

router.post(
  "/activities/:id/reports",
  authMiddleware.auth({ userTypes: "all" }),
  (req, res, next) => activityReportController.createReport(req, res).catch(next),
);

router.patch(
  "/activities/:id/status",
  authMiddleware.auth(),
  (req, res, next) => activityController.updateStatus(req, res).catch(next),
);
export default router;