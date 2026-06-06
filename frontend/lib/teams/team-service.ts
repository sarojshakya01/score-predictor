import { authenticatedApiFetch } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import type {
  ListTeamsParams,
  TeamCreate,
  TeamListResponse,
  TeamResponse,
  TeamUpdate,
} from "@/lib/teams/types";

const toQueryString = (params: ListTeamsParams): string => {
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
};

export const listAdminTeams = async (
  params: ListTeamsParams = {},
): Promise<TeamListResponse> => {
  const queryString = toQueryString(params);
  const path = queryString ? `/admin/teams?${queryString}` : "/admin/teams";

  return authenticatedApiFetch<TeamListResponse>(path, {
    method: "GET",
  });
};

export const getAdminTeam = async (teamId: number): Promise<TeamResponse> => {
  return authenticatedApiFetch<TeamResponse>(`/admin/teams/${teamId}`, {
    method: "GET",
  });
};

export const listAllTeams = async (
  params: ListTeamsParams = {},
): Promise<TeamListResponse> => {
  const queryString = toQueryString(params);
  const path = queryString ? `/teams?${queryString}` : "/teams";

  return apiFetch<TeamListResponse>(path, {
    method: "GET",
  });
};

export const createTeam = async (data: TeamCreate): Promise<TeamResponse> => {
  return authenticatedApiFetch<TeamResponse, TeamCreate>("/admin/teams", {
    body: data,
    method: "POST",
  });
};

export const updateTeam = async (
  teamId: number,
  data: TeamUpdate,
): Promise<TeamResponse> => {
  return authenticatedApiFetch<TeamResponse, TeamUpdate>(
    `/admin/teams/${teamId}`,
    {
      body: data,
      method: "PUT",
    },
  );
};

export const deleteTeam = async (teamId: number): Promise<void> => {
  await authenticatedApiFetch<null>(`/admin/teams/${teamId}`, {
    method: "DELETE",
  });
};

export const teamService = {
  createTeam,
  deleteTeam,
  getAdminTeam,
  listAdminTeams,
  updateTeam,
};
