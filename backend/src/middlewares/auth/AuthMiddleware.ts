import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { IAuthMiddleware } from "@/middlewares/auth/IAuthMiddleware.js";
import type { AuthenticatedUser, AuthorizeOptions } from "@/types/auth.js";
import { verifyJwt } from "@/utils/jwt.js";
import CustomError from "@/models/error/CustomError.js";

class AuthMiddleware implements IAuthMiddleware {
  private validate(req: Request, required: boolean): AuthenticatedUser | null {
    try {
      const cookieToken = req.cookies?.token as string | undefined;
      const headerToken = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined;

      const token = cookieToken ?? headerToken;

      if (!token) throw new CustomError(401, "No token provided.");

      const decoded = verifyJwt(token);

      if (!decoded)
        throw new CustomError(401, "Token malformatted, expired or invalid.");

      req.user = decoded;
      return decoded;
    } catch (error) {
      delete req.user;

      if (error instanceof CustomError && !required) return null;
      throw error;
    }
  }

  public auth(options: AuthorizeOptions = {}): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction): void => {
      const { userTypes, manager } = options;
      const user = this.validate(req, !!(userTypes || manager));

      if (!userTypes && !manager) return next();

      if (!user) return next();

      if (userTypes && userTypes !== "all" && !userTypes.includes(user.userType))
        throw new CustomError(403, "User type not allowed.");

      if (manager && !user.isManager)
        throw new CustomError(403, "User is not a manager.");

      next();
    };
  }
}

export default AuthMiddleware;
