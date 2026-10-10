export type UserType = "STUDENT" | "TEACHER";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  userType: UserType;
  isManager: boolean;
  createdAt: string;
  /** Absent once the session is verified: `GET /users/me` does not return it. */
  updatedAt?: string;
}

export interface UpdateProfileRequest {
  fullName: string;
  email: string;
  password?: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  userType: UserType;
  course?: string;
  registrationCode: string;
  cndb?: string;
}

export type RegisterResponse = User;

export interface AuthError {
  message: string;
  code?: string;
}
