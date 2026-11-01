import express from "express";
import UserController from "@/controllers/user/UserController.js";
import type { IUserController } from "@/controllers/user/IUserController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";
import { validateQuery } from "@/middlewares/validation/validateQuery.js";
import { ListUserActivitiesQuerySchema } from "@/schemas/user/UserActivitySchemas.js";
import { INVALID_QUERY_MESSAGE } from "@/schemas/common/PaginationSchemas.js";

const router = express.Router();
const userController: IUserController = new UserController();
const authMiddleware = new AuthMiddleware();

router.get("/users/me", authMiddleware.auth({ userTypes: "all" }), (req, res) =>
  userController.getMe(req, res),
);

router.patch(
  "/users/me",
  authMiddleware.auth({ userTypes: "all" }),
  (req, res) => userController.updateMe(req, res),
);

// 401 before 400: an expired session must reach the frontend's global 401
// handling, never show up as a query error.
router.get(
  "/users/me/activities",
  authMiddleware.auth({ userTypes: "all" }),
  validateQuery(ListUserActivitiesQuerySchema, INVALID_QUERY_MESSAGE),
  (req, res) => userController.listActivities(req, res),
);

export default router;
