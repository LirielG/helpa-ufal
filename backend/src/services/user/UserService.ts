import UserRepository from "@/repositories/auth/UserRepository.js";
import ActivityRepository from "@/repositories/activity/ActivityRepository.js";
import EnrollmentRepository from "@/repositories/enrollment/EnrollmentRepository.js";
import type { IActivityRepository } from "@/repositories/activity/IActivityRepository.js";
import type { IEnrollmentRepository } from "@/repositories/enrollment/IEnrollmentRepository.js";
import type {
  IUserRepository,
  UserWithProfile,
} from "@/repositories/auth/IUserRepository.js";
import type {
  IUserService,
  UpdateProfileInput,
} from "@/services/user/IUserService.js";
import type { UserProfileResponse } from "@/types/user.js";
import type { UserActivityResponse } from "@/types/activity.js";
import type { ListUserActivitiesQuery } from "@/schemas/user/UserActivitySchemas.js";
import { type Paginated, toPaginated } from "@/types/pagination.js";
import CustomError from "@/models/error/CustomError.js";
import bcryptjs from "bcryptjs";
import { BCRYPT_SALT_ROUNDS } from "@/utils/password.js";

type Props = {
  userRepository?: IUserRepository;
  activityRepository?: IActivityRepository;
  enrollmentRepository?: IEnrollmentRepository;
};

class UserService implements IUserService {
  private _userRepository: IUserRepository;
  private _activityRepository: IActivityRepository;
  private _enrollmentRepository: IEnrollmentRepository;

  constructor(props?: Props) {
    this._userRepository = props?.userRepository ?? new UserRepository();
    this._activityRepository =
      props?.activityRepository ?? new ActivityRepository();
    this._enrollmentRepository =
      props?.enrollmentRepository ?? new EnrollmentRepository();
  }

  public async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this._userRepository.findProfileById(userId);

    const totalWorkloadHours =
      await this._enrollmentRepository.sumConfirmedHoursByUserId(userId);

    return this.toProfileResponse(user, totalWorkloadHours);
  }

  public async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<UserProfileResponse> {
    let newHash: string | undefined;

    if (input.newPassword !== undefined) {
      const user = await this._userRepository.findById(userId);
      const isCurrentValid = await bcryptjs.compare(
        input.currentPassword ?? "",
        user.passwordHash,
      );
      if (!isCurrentValid) {
        throw new CustomError(403, "Current password is incorrect.");
      }

      const isSamePassword = await bcryptjs.compare(
        input.newPassword,
        user.passwordHash,
      );
      if (isSamePassword) {
        throw new CustomError(
          422,
          "New password must be different from the current password.",
        );
      }

      newHash = await bcryptjs.hash(input.newPassword, BCRYPT_SALT_ROUNDS);
    }

    const [updatedUser, totalWorkloadHours] = await Promise.all([
      this._userRepository.updateProfile(userId, {
        ...(input.fullName !== undefined && { fullName: input.fullName }),
        ...(input.course !== undefined && { course: input.course }),
        ...(newHash !== undefined && { passwordHash: newHash }),
      }),
      this._enrollmentRepository.sumConfirmedHoursByUserId(userId),
    ]);

    return this.toProfileResponse(updatedUser, totalWorkloadHours);
  }

  public async listActivities(
    userId: string,
    { filter, page, limit }: ListUserActivitiesQuery,
  ): Promise<Paginated<UserActivityResponse>> {
    const { items, total } = await this._activityRepository.listByUser(
      userId,
      filter,
      page,
      limit,
    );

    return toPaginated(items, total, page, limit);
  }

  private toProfileResponse(
    user: UserWithProfile,
    totalWorkloadHours: number,
  ): UserProfileResponse {
    const profile = this.academicProfile(user);

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      userType: user.userType,
      isManager: user.isManager,
      registrationCode: profile.registrationCode,
      course: profile.course,
      cndb: profile.cndb,
      createdAt: user.createdAt,
      totalWorkloadHours,
    };
  }

  /**
   * userType decides which table holds the academic fields: cndb only exists
   * on Teacher, and only a teacher may have no course. Flattening happens here
   * so the response shape stays the same for both profiles.
   */
  private academicProfile(user: UserWithProfile): {
    registrationCode: string;
    course: string | null;
    cndb: string | null;
  } {
    const profile =
      user.userType === "STUDENT"
        ? user.student && { ...user.student, cndb: null }
        : user.teacher;

    // The subtype row is written in the same transaction as the user
    // (UserRepository.createWithSubtype), so its absence means the database
    // broke an invariant this response cannot represent.
    if (!profile) throw new CustomError(500, "Profile data is inconsistent.");

    return profile;
  }
}

export default UserService;
