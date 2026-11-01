import express from "express";
import UserController from "@/controllers/user/UserController.js";
import AuthMiddleware from "@/middlewares/auth/AuthMiddleware.js";
import { validateQuery } from "@/middlewares/validation/validateQuery.js";
import { ListUserActivitiesQuerySchema } from "@/schemas/user/UserActivitySchemas.js";
import { INVALID_QUERY_MESSAGE } from "@/schemas/common/PaginationSchemas.js";

const router = express.Router();
const userController = new UserController();
const authMiddleware = new AuthMiddleware();

router.get(
  "/users/me",
  authMiddleware.auth({ userTypes: "all" }),
  (req, res, next) => userController.getMe(req, res).catch(next),
);

router.patch(
  "/users/me",
  authMiddleware.auth({ userTypes: "all" }),
  (req, res, next) => userController.updateMe(req, res).catch(next),
);

// 401 before 400: an expired session must reach the frontend's global 401
// handling, never show up as a query error.
router.get(
  "/users/me/activities",
  authMiddleware.auth({ userTypes: "all" }),
  validateQuery(ListUserActivitiesQuerySchema, INVALID_QUERY_MESSAGE),
  (req, res, next) => userController.listActivities(req, res).catch(next),
);

export default router;
