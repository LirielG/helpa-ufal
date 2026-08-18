import express from "express";
import UserController from "@/controllers/user/UserController.js";
import type { IUserController } from "@/controllers/user/IUserController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";

const router = express.Router();
const userController: IUserController = new UserController();
const authMiddleware = new AuthMiddleware();

const authGuard = authMiddleware.auth({ userTypes: "all" });

router.get("/me", authGuard, (req, res) => userController.getProfile(req, res));
router.put("/me", authGuard, (req, res) => userController.updateProfile(req, res));

export default router;
