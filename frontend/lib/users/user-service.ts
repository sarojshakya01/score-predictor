import { authenticatedApiFetch } from "@/lib/auth";
import type {
  ListUsersParams,
  UserCreate,
  UserListResponse,
  UserResponse,
  UserUpdate,
} from "@/lib/users/types";

const toQueryString = (params: ListUsersParams): string => {
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
};

export const listAdminUsers = async (
  params: ListUsersParams = {},
): Promise<UserListResponse> => {
  const queryString = toQueryString(params);
  const path = queryString ? `/admin/users?${queryString}` : "/admin/users";

  return authenticatedApiFetch<UserListResponse>(path, {
    method: "GET",
  });
};

export const getAdminUser = async (userId: number): Promise<UserResponse> => {
  return authenticatedApiFetch<UserResponse>(`/admin/users/${userId}`, {
    method: "GET",
  });
};

export const createUser = async (data: UserCreate): Promise<UserResponse> => {
  return authenticatedApiFetch<UserResponse, UserCreate>("/admin/users", {
    body: data,
    method: "POST",
  });
};

export const updateUser = async (
  userId: number,
  data: UserUpdate,
): Promise<UserResponse> => {
  return authenticatedApiFetch<UserResponse, UserUpdate>(
    `/admin/users/${userId}`,
    {
      body: data,
      method: "PUT",
    },
  );
};

export const updateCurrentUserFinalist = async (data: UserUpdate): Promise<UserResponse> => {
  return authenticatedApiFetch<UserResponse, UserUpdate>(`/users/finalist`, {
    body: data,
    method: "PUT",
  });
}

export const deleteUser = async (userId: number): Promise<void> => {
  await authenticatedApiFetch<null>(`/admin/users/${userId}`, {
    method: "DELETE",
  });
};

export const userService = {
  createUser,
  deleteUser,
  getAdminUser,
  listAdminUsers,
  updateUser,
};
