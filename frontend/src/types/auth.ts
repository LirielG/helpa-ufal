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
  updatedAt: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  userType: UserType;
  course: string;
  registrationCode: string;
  cndb?: string;
}

export interface RegisterResponse {
  token: string;
  user: User;
}

export interface AuthError {
  message: string;
  code?: string;
}
