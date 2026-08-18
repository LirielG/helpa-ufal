import type { Request, Response } from "express";
import UserService from "@/services/user/UserService.js";
import type { IUserService } from "@/services/user/IUserService.js";
import type { IUserController } from "@/controllers/user/IUserController.js";
import { UpdateUserSchema } from "@/schemas/user/UserSchemas.js";
import CustomError from "@/models/error/CustomError.js";

type Props = {
  userService?: IUserService;
};

class UserController implements IUserController {
  private _userService: IUserService;

  constructor(props?: Props) {
    this._userService = props?.userService ?? new UserService();
  }

  public async getProfile(req: Request, res: Response): Promise<void> {
    if (!req.user?.id) {
      throw new CustomError(401, "Usuário não autenticado.");
    }

    const profile = await this._userService.getProfile(req.user.id);
    res.status(200).json(profile);
  }

  public async updateProfile(req: Request, res: Response): Promise<void> {
    if (!req.user?.id) {
      throw new CustomError(401, "Usuário não autenticado.");
    }

    const data = UpdateUserSchema.parse(req.body);
    const updatedProfile = await this._userService.updateProfile(
      req.user.id,
      data,
    );

    res.status(200).json(updatedProfile);
  }
}

export default UserController;
