import { RoleName, type UserResponse, type UserRole } from "@/lib/auth/types";

type UserWithRole = Pick<UserResponse, "role"> | null | undefined;

export const hasRole = (
  user: UserWithRole,
  allowedRoles: readonly UserRole[],
): boolean => {
  return Boolean(user && allowedRoles.includes(user.role));
};

export const isAdmin = (user: UserWithRole): boolean => {
  return hasRole(user, [RoleName.ADMIN]);
};
