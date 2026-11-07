import express from "express";
import AuthController from "@/controllers/auth/AuthController.js";
import type { IAuthController } from "@/controllers/auth/IAuthController.js";
import {
  loginRateLimiter,
  registerRateLimiter,
} from "@/middlewares/rateLimit/publicRateLimiters.js";

const router = express.Router();
const authController: IAuthController = new AuthController();

router.post("/login", loginRateLimiter, (req, res) =>
  authController.login(req, res),
);
router.post("/register", registerRateLimiter, (req, res) =>
  authController.register(req, res),
);
router.post("/logout", (req, res) => authController.logout(req, res));

export default router;
