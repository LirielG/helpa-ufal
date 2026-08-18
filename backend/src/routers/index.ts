import express from "express";
import AuthRouter from "@/routers/auth/AuthRouter.js";
import UserRouter from "@/routers/user/UserRouter.js";

const router = express.Router();

router.use("/auth", AuthRouter);
router.use("/users", UserRouter);

export default router;

