import { apiFetch } from "@/lib/api";
import { authenticatedApiFetch } from "@/lib/auth";
import type {
  ListAdminMatchesParams,
  ListUpcomingMatchesParams,
  MatchCreate,
  MatchListResponse,
  MatchResponse,
  MatchUpdate,
} from "@/lib/matches/types";

function toUpcomingQueryString(params: ListUpcomingMatchesParams): string {
  const searchParams = new URLSearchParams();

  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.includeLocked !== undefined) {
    searchParams.set("include_locked", String(params.includeLocked));
  }

  return searchParams.toString();
}

function toAdminQueryString(params: ListAdminMatchesParams): string {
  const searchParams = new URLSearchParams();

  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.matchDay !== undefined) {
    searchParams.set("match_day", String(params.matchDay));
  }

  if (params.matchLocked !== undefined) {
    searchParams.set("match_locked", String(params.matchLocked));
  }

  return searchParams.toString();
}

export async function listUpcomingMatches(
  params: ListUpcomingMatchesParams = {},
): Promise<MatchListResponse> {
  const queryString = toUpcomingQueryString(params);
  const path = queryString
    ? `/matches/upcoming/?${queryString}`
    : "/matches/upcoming/";

  return apiFetch<MatchListResponse>(path, {
    method: "GET",
  });
}

export async function listAdminMatches(
  params: ListAdminMatchesParams = {},
): Promise<MatchListResponse> {
  const queryString = toAdminQueryString(params);
  const path = queryString ? `/admin/matches?${queryString}` : "/admin/matches";

  return authenticatedApiFetch<MatchListResponse>(path, {
    method: "GET",
  });
}

export async function createMatch(data: MatchCreate): Promise<MatchResponse> {
  return authenticatedApiFetch<MatchResponse, MatchCreate>("/admin/matches", {
    body: data,
    method: "POST",
  });
}

export async function updateMatch(
  matchId: number,
  data: MatchUpdate,
): Promise<MatchResponse> {
  return authenticatedApiFetch<MatchResponse, MatchUpdate>(
    `/admin/matches/${matchId}`,
    {
      body: data,
      method: "PUT",
    },
  );
}

export async function deleteMatch(matchId: number): Promise<void> {
  await authenticatedApiFetch<null>(`/admin/matches/${matchId}`, {
    method: "DELETE",
  });
}

export const matchService = {
  createMatch,
  deleteMatch,
  listAdminMatches,
  listUpcomingMatches,
  updateMatch,
};
