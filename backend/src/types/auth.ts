export type UserType = "STUDENT" | "TEACHER" | "EXTERNAL";

export type AuthenticatedUser = {
  id: string;
  userType: UserType;
  isManager: boolean;
};

export type AuthorizeOptions = {
  userTypes?: UserType[];
  manager?: boolean;
};
