import type { UpdateUserInput } from "@/schemas/user/UserSchemas.js";
import type { UserProfileResponse } from "@/types/user.js";

export interface IUserService {
  getProfile(userId: string): Promise<UserProfileResponse>;
  updateProfile(
    userId: string,
    data: UpdateUserInput,
  ): Promise<UserProfileResponse>;
}
