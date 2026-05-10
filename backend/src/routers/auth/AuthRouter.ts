import express from "express";
import AuthController from "@/controllers/auth/AuthController.js";
import type { IAuthController } from "@/controllers/auth/IAuthController.js";

const router = express.Router();
const controller: IAuthController = new AuthController();

router.post("/login", (req, res) => controller.login(req, res));

export default router;
