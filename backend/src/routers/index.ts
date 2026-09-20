import express from "express";
import AuthRouter from "@/routers/auth/AuthRouter.js";
import ActivityRouter from "@/routers/activity/ActivityRouter.js";
import EnrollmentRouter from "@/routers/enrollment/EnrollmentRouter.js";
import SigaaActivityRouter from "@/routers/sigaa/SigaaActivityRouter.js";
import UserRouter from "@/routers/user/UserRouter.js";

const router = express.Router();

router.use("/auth", AuthRouter);
router.use("/", ActivityRouter);
router.use("/", EnrollmentRouter);
router.use("/", SigaaActivityRouter);
router.use("/", UserRouter);

export default router;
