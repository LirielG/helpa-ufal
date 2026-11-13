import express from "express";
import SigaaActivityController from "@/controllers/sigaa/SigaaActivityController.js";
import type { ISigaaActivityController } from "@/controllers/sigaa/ISigaaActivityController.js";

const router = express.Router();
const controller: ISigaaActivityController = new SigaaActivityController();

router.get("/sigaa-activities", (req, res) => controller.list(req, res));

router.get("/sigaa-activities/filters", (req, res) =>
  controller.listFilters(req, res),
);

export default router;
