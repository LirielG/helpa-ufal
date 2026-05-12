export type UserType = "STUDENT" | "TEACHER";

export type AuthenticatedUser = {
  id: string;
  userType: UserType;
  isManager: boolean;
};

export type AuthorizeOptions = {
  userTypes?: UserType[] | "all";
  manager?: boolean;
};
