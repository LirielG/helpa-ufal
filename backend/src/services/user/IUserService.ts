import type { UserProfileResponse } from "@/types/user.js";

export type UpdateProfileInput = {
  fullName?: string;
  course?: string | null;
  currentPassword?: string;
  newPassword?: string;
};

export interface IUserService {
  getProfile(userId: string): Promise<UserProfileResponse>;
  updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<UserProfileResponse>;
}
