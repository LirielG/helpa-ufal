import UserRepository from "@/repositories/auth/UserRepository.js";
import type {
  IUserRepository,
  UserWithSubtype,
} from "@/repositories/auth/IUserRepository.js";
import type { IUserService } from "@/services/user/IUserService.js";
import type { UpdateUserInput } from "@/schemas/user/UserSchemas.js";
import type { UserProfileResponse } from "@/types/user.js";
import CustomError from "@/models/error/CustomError.js";
import bcryptjs from "bcryptjs";

type Props = {
  userRepository?: IUserRepository;
};

class UserService implements IUserService {
  private _userRepository: IUserRepository;

  constructor(props?: Props) {
    this._userRepository = props?.userRepository ?? new UserRepository();
  }

  private mapToProfileResponse(user: UserWithSubtype): UserProfileResponse {
    const course = user.student?.course ?? user.teacher?.course ?? null;
    const registrationCode =
      user.student?.registrationCode ?? user.teacher?.registrationCode ?? null;
    const cndb = user.teacher?.cndb ?? null;

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      userType: user.userType,
      isManager: user.isManager,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      course,
      registrationCode,
      cndb,
      student: user.student
        ? {
            registrationCode: user.student.registrationCode,
            course: user.student.course,
          }
        : null,
      teacher: user.teacher
        ? {
            registrationCode: user.teacher.registrationCode,
            cndb: user.teacher.cndb,
            course: user.teacher.course,
          }
        : null,
    };
  }

  public async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this._userRepository.findById(userId);

    if (!user) {
      throw new CustomError(404, "Usuário não encontrado.");
    }

    return this.mapToProfileResponse(user);
  }

  public async updateProfile(
    userId: string,
    data: UpdateUserInput,
  ): Promise<UserProfileResponse> {
    const user = await this._userRepository.findById(userId);

    if (!user) {
      throw new CustomError(404, "Usuário não encontrado.");
    }

    if (data.email && data.email !== user.email) {
      const existingUser = await this._userRepository.findByEmail(data.email);
      if (existingUser && existingUser.id !== userId) {
        throw new CustomError(409, "E-mail já está em uso.");
      }
    }

    let passwordHash: string | undefined = undefined;
    if (data.password) {
      passwordHash = await bcryptjs.hash(data.password, 12);
    }

    const updatedUser = await this._userRepository.updateUser(
      userId,
      user.userType,
      {
        fullName: data.fullName,
        email: data.email,
        passwordHash,
        course: data.course,
        registrationCode: data.registrationCode,
        cndb: data.cndb,
      },
    );

    return this.mapToProfileResponse(updatedUser);
  }
}

export default UserService;
