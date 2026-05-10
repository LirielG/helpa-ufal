export type UserType = "student" | "teacher" | "external";

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
  name: string;
  type: UserType;
  createdAt: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  type: UserType;
  institution?: string;
  cndbNumber?: string;
  course?: string;
  enrollment?: string;
}

export interface RegisterResponse {
  token: string;
  user: User;
}

export interface AuthError {
  message: string;
  code?: string;
}
