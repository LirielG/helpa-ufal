import express from "express";
import AuthController from "@/controllers/auth/AuthController.js";
import type { IAuthController } from "@/controllers/auth/IAuthController.js";

const router = express.Router();
const authController: IAuthController = new AuthController();

router.post("/login", (req, res) => authController.login(req, res));
router.post("/register", (req, res) => authController.register(req, res));

export default router;