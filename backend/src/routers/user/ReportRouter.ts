import express from "express";
import { ReportController } from "@/controllers/activityReport/ReportController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";

const router = express.Router();
const reportController = new ReportController();
const authMiddleware = new AuthMiddleware();

router.get(
  "/reports",
  authMiddleware.auth({ manager: true }),
  (req, res, next) => reportController.list(req, res).catch(next),
);

router.patch(
  "/reports/:id/resolve",
  authMiddleware.auth({ manager: true }),
  (req, res, next) => reportController.resolve(req, res).catch(next),
);

export default router;