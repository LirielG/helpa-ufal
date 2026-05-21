import express from "express";
import AuthRouter from "@/routers/auth/AuthRouter.js";

const router = express.Router();

router.use("/auth", AuthRouter);

export default router;
