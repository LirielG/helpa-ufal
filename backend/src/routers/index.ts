import express from "express";
import AuthRouter from "@/routers/auth/AuthRouter.js";
import { ActivityController } from '../controllers/ActivityController.js';

const router = express.Router();

router.use("/auth", AuthRouter);

const activityController = new ActivityController();
router.get('/acoes', activityController.list);

export default router;
