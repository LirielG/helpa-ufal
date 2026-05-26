import express from "express";
import ActivityController from "@/controllers/activity/ActivityController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";
import type { IActivityController } from "@/controllers/activity/IActivityController.js";

import type { IAuthMiddleware } from "@/middlewares/auth/IAuthMiddleware.js";


const router = express.Router();
const activityController: IActivityController = new ActivityController();

const authMiddleware:     IAuthMiddleware      = new AuthMiddleware();

router.post(
  "/activities",
  authMiddleware.auth(),
  (req, res, next) => activityController.create(req, res).catch(next),
);

export default router;