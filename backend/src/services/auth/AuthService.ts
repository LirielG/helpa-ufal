import UserRepository from "@/repositories/auth/UserRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import type { IAuthService } from "@/services/auth/IAuthService.js";
import CustomError from "@/models/error/CustomError.js";
import bcryptjs from "bcryptjs";
import { signJwt } from "@/utils/jwt.js";
import type { Login } from "@/schemas/auth/AuthSchemas.js";
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
}

export default AuthService;
