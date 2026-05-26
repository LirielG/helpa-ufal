import express from "express";
import AuthRouter from "@/routers/auth/AuthRouter.js";
import ActivityRouter from "@/routers/activity/ActivityRouter.js";

const router = express.Router();

router.use("/auth", AuthRouter);
router.use("/", ActivityRouter)

export default router;
