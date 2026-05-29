import { authenticatedApiFetch } from "@/lib/auth";
import type {
  ListAdminTeamsParams,
  TeamCreate,
  TeamListResponse,
  TeamResponse,
  TeamUpdate,
} from "@/lib/teams/types";

function toQueryString(params: ListAdminTeamsParams): string {
  const searchParams = new URLSearchParams();

  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.group !== undefined) {
    searchParams.set("group", params.group);
  }

  if (params.search !== undefined) {
    searchParams.set("search", params.search);
  }

  return searchParams.toString();
}

export async function listAdminTeams(
  params: ListAdminTeamsParams = {},
): Promise<TeamListResponse> {
  const queryString = toQueryString(params);
  const path = queryString ? `/admin/teams?${queryString}` : "/admin/teams";

  return authenticatedApiFetch<TeamListResponse>(path, {
    method: "GET",
  });
}

export async function createTeam(data: TeamCreate): Promise<TeamResponse> {
  return authenticatedApiFetch<TeamResponse, TeamCreate>("/admin/teams", {
    body: data,
    method: "POST",
  });
}

export async function updateTeam(
  teamId: number,
  data: TeamUpdate,
): Promise<TeamResponse> {
  return authenticatedApiFetch<TeamResponse, TeamUpdate>(
    `/admin/teams/${teamId}`,
    {
      body: data,
      method: "PUT",
    },
  );
}

export async function deleteTeam(teamId: number): Promise<void> {
  await authenticatedApiFetch<null>(`/admin/teams/${teamId}`, {
    method: "DELETE",
  });
}

export const teamService = {
  createTeam,
  deleteTeam,
  listAdminTeams,
  updateTeam,
};
