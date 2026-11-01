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
      const token = req.cookies?.token as string | undefined;

      if (!token) throw new CustomError(401, "No token provided.");

      const decoded = verifyJwt(token);

      if (!decoded) throw new CustomError(401, INVALID_TOKEN_MESSAGE);

      const stored = await this._userRepository.findSessionById(decoded.id);

      if (!stored || stored.tokenVersion !== decoded.tokenVersion)
        throw new CustomError(401, "Session is no longer valid.", {
          code: "SESSION_INVALID",
        });

      req.user = stored;
      return stored;
    } catch (error) {
      delete req.user;

      // A removed or revoked session must end even on routes that also
      // allow anonymous access. Other optional-auth behavior is unchanged.
      if (
        !required &&
        !(error instanceof CustomError && error.code === "SESSION_INVALID")
      )
        return null;
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
