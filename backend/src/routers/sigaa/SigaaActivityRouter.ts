import express from "express";
import SigaaActivityController from "@/controllers/sigaa/SigaaActivityController.js";
import type { ISigaaActivityController } from "@/controllers/sigaa/ISigaaActivityController.js";

const router = express.Router();
const controller: ISigaaActivityController = new SigaaActivityController();

router.get(
  "/sigaa-activities",
  (req, res, next) => controller.list(req, res).catch(next),
);

router.get(
  "/sigaa-activities/departments",
  (req, res, next) => controller.listDepartments(req, res).catch(next),
);

export default router;
