import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { IAuthMiddleware } from "@/middlewares/auth/IAuthMiddleware.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import UserRepository from "@/repositories/auth/UserRepository.js";
import type { AuthenticatedUser, AuthorizeOptions } from "@/types/auth.js";
import { verifyJwt } from "@/utils/jwt.js";
import CustomError from "@/models/error/CustomError.js";

type Props = {
  userRepository?: IUserRepository;
};

const INVALID_TOKEN_MESSAGE = "Token malformatted, expired or invalid.";

class AuthMiddleware implements IAuthMiddleware {
  private _userRepository: IUserRepository;

  constructor(props?: Props) {
    this._userRepository = props?.userRepository ?? new UserRepository();
  }

  private async validate(
    req: Request,
    required: boolean,
  ): Promise<AuthenticatedUser | null> {
    try {
      const cookieToken = req.cookies?.token as string | undefined;
      const headerToken = req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined;

      const token = cookieToken ?? headerToken;

      if (!token) throw new CustomError(401, "No token provided.");

      const decoded = verifyJwt(token);

      if (!decoded) throw new CustomError(401, INVALID_TOKEN_MESSAGE);

      // A missing user is not rejected here: each service already answers
      // for it (e.g. 404 on GET /users/me).
      const stored = await this._userRepository.findTokenVersionById(
        decoded.id,
      );

      if (stored && stored.tokenVersion !== decoded.tokenVersion)
        throw new CustomError(401, INVALID_TOKEN_MESSAGE);

      req.user = decoded;
      return decoded;
    } catch (error) {
      delete req.user;

      if (error instanceof CustomError && !required) return null;
      throw error;
    }
  }

  public auth(options: AuthorizeOptions = {}): RequestHandler {
    return async (
      req: Request,
      _res: Response,
      next: NextFunction,
    ): Promise<void> => {
      const { userTypes, manager } = options;
      const user = await this.validate(req, !!(userTypes || manager));

      if (!userTypes && !manager) return next();

      if (!user) return next();

      if (
        userTypes &&
        userTypes !== "all" &&
        !userTypes.includes(user.userType)
      )
        throw new CustomError(403, "User type not allowed.");

      if (manager && !user.isManager)
        throw new CustomError(403, "User is not a manager.");

      next();
    };
  }
}

export default AuthMiddleware;
