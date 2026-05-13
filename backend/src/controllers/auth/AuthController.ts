import type { Request, Response } from "express";
import AuthService from "@/services/auth/AuthService.js";
import type { IAuthService } from "@/services/auth/IAuthService.js";
import type { IAuthController } from "@/controllers/auth/IAuthController.js";
import { LoginSchema, RegisterSchema } from "@/schemas/auth/AuthSchemas.js";
import { env } from "@/config/env.js";

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

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(200).json(result);
  }

  public async register(req: Request, res: Response): Promise<void> {
    const data = RegisterSchema.parse(req.body);
    const result = await this._authService.register(data);

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
    });

    res.status(201).json(result);
  }

  public async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie("token", {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
    });
    
    res.status(204).send();
  }
}

export default AuthController;
