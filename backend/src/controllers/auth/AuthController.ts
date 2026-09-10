import type { Request, Response } from "express";
import AuthService from "@/services/auth/AuthService.js";
import type { IAuthService } from "@/services/auth/IAuthService.js";
import type { IAuthController } from "@/controllers/auth/IAuthController.js";
import { LoginSchema, RegisterSchema } from "@/schemas/auth/AuthSchemas.js";
import { authCookieMaxAge, authCookieOptions } from "@/config/auth-cookie.js";

type Props = {
  authService?: IAuthService;
};

class AuthController implements IAuthController {
  private _authService: IAuthService;

  constructor(props?: Props) {
    this._authService = props?.authService ?? new AuthService();
  }

  public async login(req: Request, res: Response): Promise<void> {
    const data = LoginSchema.parse(req.body);
    const result = await this._authService.login(data);

    // maxAge is applied only on write; the base object (no maxAge/expires) is
    // the same one passed to clearCookie — the two can no longer diverge.
    res.cookie("token", result.token, {
      ...authCookieOptions,
      maxAge: authCookieMaxAge,
    });

    res.status(200).json(result);
  }

  public async register(req: Request, res: Response): Promise<void> {
    const data = RegisterSchema.parse(req.body);
    const user = await this._authService.register(data);

    res.status(201).json(user);
  }

  public async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie("token", authCookieOptions);

    res.status(204).send();
  }
}

export default AuthController;
