import express from "express";
import UserController from "@/controllers/user/UserController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";

const router = express.Router();
const userController = new UserController();
const authMiddleware = new AuthMiddleware();

router.get("/users/me", authMiddleware.auth({ userTypes: "all" }), (req, res) =>
  userController.getMe(req, res),
);

export default router;
