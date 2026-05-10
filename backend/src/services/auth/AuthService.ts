import UserRepository from "@/repositories/auth/UserRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import type { IAuthService } from "@/services/auth/IAuthService.js";
import CustomError from "@/models/error/CustomError.js";
import bcryptjs from "bcryptjs";
import { signJwt } from "@/utils/jwt.js";
import type { Login, RegisterInput } from "@/schemas/auth/AuthSchemas.js";
import type { AuthenticatedUser } from "@/types/auth.js";

type Props = {
  userRepository?: IUserRepository;
};

class AuthService implements IAuthService {
  private _userRepository: IUserRepository;

  constructor(props?: Props) {
    this._userRepository = props?.userRepository ?? new UserRepository();
  }

  public async login(
    data: Login,
  ): Promise<{ token: string; user: AuthenticatedUser }> {
    const user = await this._userRepository.findByEmail(data.email);

    if (!user) {
      throw new CustomError(401, "Invalid credentials.");
    }

    const passwordMatch = await bcryptjs.compare(
      data.password,
      user.passwordHash,
    );

    if (!passwordMatch) {
      throw new CustomError(401, "Invalid credentials.");
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      userType: user.userType,
      isManager: user.isManager,
    };

    const token = signJwt(authenticatedUser);

    return { token, user: authenticatedUser };
  }

  
  public async register(
  data: RegisterInput,
): Promise<{ token: string; user: AuthenticatedUser }> {
  const existingUser = await this._userRepository.findByEmail(data.email);

  if (existingUser) {
    throw new CustomError(409, "Email already in use.");
  }

  const passwordHash = await bcryptjs.hash(data.password, 10);

  const newUser = await this._userRepository.create({
    fullName:     data.fullName,
    email:        data.email,
    passwordHash,
    userType:     data.userType,
    course:       data.course ?? null,
    isManager:    false, // default for default users
  });

  switch (data.userType) {
    case "STUDENT":
      await this._userRepository.createStudent({
        userId:           newUser.id,
        registrationCode: data.registrationCode,
      });
      break;

    case "TEACHER":
      await this._userRepository.createTeacher({
        userId:           newUser.id,
        registrationCode: data.registrationCode,
        cndb:             data.cndb,
      });
      break;

    case "EXTERNAL":
      await this._userRepository.createExternal({
        userId:      newUser.id,
        institution: data.institution ?? null,
      });
      break;
  }

  const authenticatedUser: AuthenticatedUser = {
    id:        newUser.id,
    userType:  newUser.userType,
    isManager: newUser.isManager,
  };

  const token = signJwt(authenticatedUser);

  return { token, user: authenticatedUser };
}

}

export default AuthService;
