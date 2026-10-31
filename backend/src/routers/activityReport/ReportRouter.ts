import express from "express";
import ActivityReportController from "@/controllers/activityReport/AcitivtyReportController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";
import type { IActivityReportController } from "@/controllers/activityReport/IActivityReportController.js";
import type { IAuthMiddleware } from "@/middlewares/auth/IAuthMiddleware.js";
import { validateQuery } from "@/middlewares/validation/validateQuery.js";
import { ListReportsQuerySchema } from "@/schemas/activityReport/activityReportSchemas.js";
import { INVALID_QUERY_MESSAGE } from "@/schemas/common/PaginationSchemas.js";

const router = express.Router();
const activityReportController: IActivityReportController =
  new ActivityReportController();
const authMiddleware: IAuthMiddleware = new AuthMiddleware();

// Validation order: 401 -> 403 (manager role) -> 400 (format) -> 404. The
// middleware checks the current role before the request reaches the service.
router.get(
  "/reports",
  authMiddleware.auth({ manager: true }),
  validateQuery(ListReportsQuerySchema, INVALID_QUERY_MESSAGE),
  (req, res, next) =>
    activityReportController.listReports(req, res).catch(next),
);

router.put(
  "/reports/:reportId/resolution",
  authMiddleware.auth({ manager: true }),
  (req, res, next) =>
    activityReportController.resolveReport(req, res).catch(next),
);

export default router;
