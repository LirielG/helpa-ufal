import type { Request, Response } from "express";
import UserService from "@/services/user/UserService.js";
import type { IUserService } from "@/services/user/IUserService.js";
import type { IUserController } from "@/controllers/user/IUserController.js";
import CustomError from "@/models/error/CustomError.js";

type Props = {
  userService?: IUserService;
};

class UserController implements IUserController {
  private _userService: IUserService;

  constructor(props?: Props) {
    this._userService = props?.userService ?? new UserService();
  }

  public async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    // The id comes from the token and from nowhere else, so the route cannot be pointed at someone else's profile.
    const profile = await this._userService.getProfile(req.user.id);

    res.status(200).json(profile);
  }
}

export default UserController;
