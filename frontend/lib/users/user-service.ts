import { authenticatedApiFetch } from "@/lib/auth";
import type {
  ListAdminUsersParams,
  UserCreate,
  UserListResponse,
  UserResponse,
  UserUpdate,
} from "@/lib/users/types";

function toQueryString(params: ListAdminUsersParams): string {
  const searchParams = new URLSearchParams();

  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.role !== undefined) {
    searchParams.set("role", params.role);
  }

  if (params.is_active !== undefined) {
    searchParams.set("is_active", String(params.is_active));
  }

  if (params.search !== undefined) {
    searchParams.set("search", params.search);
  }

  return searchParams.toString();
}

export async function listAdminUsers(
  params: ListAdminUsersParams = {},
): Promise<UserListResponse> {
  const queryString = toQueryString(params);
  const path = queryString ? `/admin/users?${queryString}` : "/admin/users";

  return authenticatedApiFetch<UserListResponse>(path, {
    method: "GET",
  });
}

export async function createUser(data: UserCreate): Promise<UserResponse> {
  return authenticatedApiFetch<UserResponse, UserCreate>("/admin/users", {
    body: data,
    method: "POST",
  });
}

export async function updateUser(
  userId: number,
  data: UserUpdate,
): Promise<UserResponse> {
  return authenticatedApiFetch<UserResponse, UserUpdate>(
    `/admin/users/${userId}`,
    {
      body: data,
      method: "PUT",
    },
  );
}

export async function deleteUser(userId: number): Promise<void> {
  await authenticatedApiFetch<null>(`/admin/users/${userId}`, {
    method: "DELETE",
  });
}

export const userService = {
  createUser,
  deleteUser,
  listAdminUsers,
  updateUser,
};
