import type { Request, Response } from "express";
import UserService from "@/services/user/UserService.js";
import type { IUserService } from "@/services/user/IUserService.js";
import type { IUserController } from "@/controllers/user/IUserController.js";
import type { ListUserActivitiesQuery } from "@/schemas/user/UserActivitySchemas.js";
import CustomError from "@/models/error/CustomError.js";
import { updateProfileSchemaFor } from "@/schemas/user/UserSchemas.js";
import { authCookieOptions } from "@/config/auth-cookie.js";

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

  public async updateMe(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "No token provided.");

    const schema = updateProfileSchemaFor(req.user.userType);
    const data = schema.parse(req.body);

    const profile = await this._userService.updateProfile(req.user.id, data);

    if (data.newPassword !== undefined) {
      res.clearCookie("token", authCookieOptions);
    }

    res.status(200).json(profile);
  }

  public async listActivities(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new CustomError(401, "Unauthenticated.");

    // Parsed and defaulted by validateQuery(ListUserActivitiesQuerySchema) on the route.
    const query = res.locals.validatedQuery as ListUserActivitiesQuery;
    const page = await this._userService.listActivities(req.user.id, query);

    res.status(200).json(page);
  }
}

export default UserController;
