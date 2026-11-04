import type { Request, RequestHandler } from "express";
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

  private async validate(req: Request): Promise<AuthenticatedUser> {
    delete req.user;
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
  }

  public requireAuth(options: AuthorizeOptions = {}): RequestHandler {
    return async (req, _res, next): Promise<void> => {
      const { userTypes, manager } = options;
      const user = await this.validate(req);

      if (userTypes && !userTypes.includes(user.userType))
        throw new CustomError(403, "User type not allowed.");

      if (manager && !user.isManager)
        throw new CustomError(403, "User is not a manager.");

      next();
    };
  }

  public optionalAuth(): RequestHandler {
    return async (req, _res, next): Promise<void> => {
      delete req.user;
      if (req.cookies?.token !== undefined) await this.validate(req);
      next();
    };
  }
}

export default AuthMiddleware;
