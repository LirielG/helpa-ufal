import type { UserProfileResponse } from "@/types/user.js";

export interface IUserService {
  getProfile(userId: string): Promise<UserProfileResponse>;
}
