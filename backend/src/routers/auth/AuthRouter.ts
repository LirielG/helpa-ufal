import express from "express";
import AuthController from "@/controllers/auth/AuthController.js";
import type { IAuthController } from "@/controllers/auth/IAuthController.js";
import {
  forgotPasswordEmailRateLimiter,
  forgotPasswordIpRateLimiter,
  loginRateLimiter,
  registerRateLimiter,
  resetPasswordRateLimiter,
  verifyResetCodeRateLimiter,
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
// The IP limiter runs first, so one client cannot burn every address's quota.
router.post(
  "/forgot-password",
  forgotPasswordIpRateLimiter,
  forgotPasswordEmailRateLimiter,
  (req, res) => authController.forgotPassword(req, res),
);
router.post("/forgot-password/verify", verifyResetCodeRateLimiter, (req, res) =>
  authController.verifyResetCode(req, res),
);
router.post("/reset-password", resetPasswordRateLimiter, (req, res) =>
  authController.resetPassword(req, res),
);

export default router;
