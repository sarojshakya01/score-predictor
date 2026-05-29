import { apiFetch } from "@/lib/api";
import type { GroupTableListResponse } from "@/lib/groups/types";

export async function listGroupTables(): Promise<GroupTableListResponse> {
  return apiFetch<GroupTableListResponse>("/groups", {
    method: "GET",
  });
}

export const groupService = {
  listGroupTables,
};
