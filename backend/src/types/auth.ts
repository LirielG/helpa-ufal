export type UserType = "STUDENT" | "TEACHER";

export type AuthenticatedUser = {
  id: string;
  userType: UserType;
  isManager: boolean;
};

export type LoginUser = {
  id: string;
  fullName: string;
  email: string;
  userType: UserType;
  isManager: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthorizeOptions = {
  userTypes?: UserType[] | "all";
  manager?: boolean;
};
