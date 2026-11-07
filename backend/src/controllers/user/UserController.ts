import type { Request, Response } from "express";
import type { AuthenticatedUser } from "@/types/auth.js";
import UserService from "@/services/user/UserService.js";
import type { IUserService } from "@/services/user/IUserService.js";
import type { IUserController } from "@/controllers/user/IUserController.js";
import type { ListUserActivitiesQuery } from "@/schemas/user/UserActivitySchemas.js";
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
    const user = req.user as AuthenticatedUser;

    // The id comes from the token and from nowhere else, so the route cannot be pointed at someone else's profile.
    const profile = await this._userService.getProfile(user.id);

    res.status(200).json(profile);
  }

  public async updateMe(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    const schema = updateProfileSchemaFor(user.userType);
    const data = schema.parse(req.body);

    const profile = await this._userService.updateProfile(user.id, data);

    if (data.newPassword !== undefined) {
      res.clearCookie("token", authCookieOptions);
    }

    res.status(200).json(profile);
  }

  public async listActivities(req: Request, res: Response): Promise<void> {
    const user = req.user as AuthenticatedUser;

    // Parsed and defaulted by validateQuery(ListUserActivitiesQuerySchema) on the route.
    const query = res.locals.validatedQuery as ListUserActivitiesQuery;
    const page = await this._userService.listActivities(user.id, query);

    res.status(200).json(page);
  }
}

export default UserController;
