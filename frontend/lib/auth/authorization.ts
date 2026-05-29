import type { UserResponse, UserRole } from "@/lib/auth/types";

type UserWithRole = Pick<UserResponse, "role"> | null | undefined;

export function hasRole(
  user: UserWithRole,
  allowedRoles: readonly UserRole[],
): boolean {
  return Boolean(user && allowedRoles.includes(user.role));
}

export function isAdmin(user: UserWithRole): boolean {
  return hasRole(user, ["ADMIN"]);
}
