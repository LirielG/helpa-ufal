import express from "express";
import SigaaActivityController from "@/controllers/sigaa/SigaaActivityController.js";
import type { ISigaaActivityController } from "@/controllers/sigaa/ISigaaActivityController.js";
import { validateQuery } from "@/middlewares/validation/validateQuery.js";
import { INVALID_QUERY_MESSAGE } from "@/schemas/common/PaginationSchemas.js";
import { ListSigaaActivitiesQuerySchema } from "@/schemas/sigaa/SigaaActivitySchemas.js";

const router = express.Router();
const controller: ISigaaActivityController = new SigaaActivityController();

router.get(
  "/sigaa-activities",
  validateQuery(ListSigaaActivitiesQuerySchema, INVALID_QUERY_MESSAGE),
  (req, res) => controller.list(req, res),
);

router.get("/sigaa-activities/filters", (req, res) =>
  controller.listFilters(req, res),
);

export default router;
