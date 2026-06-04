import { apiFetch } from "@/lib/api";
import { authenticatedApiFetch } from "@/lib/auth";
import type {
  HeadToHeadResponse,
  ListMatchesParams,
  ListUpcomingMatchesParams,
  MatchCreate,
  MatchDayResponse,
  MatchListResponse,
  MatchResponse,
  MatchUpdate,
} from "@/lib/matches/types";

const toUpcomingQueryString = (params: ListUpcomingMatchesParams): string => {
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
};

const toMatchQueryString = (params: ListMatchesParams): string => {
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

  if (params.matchStage !== undefined) {
    searchParams.set("match_stage", params.matchStage);
  }

  return searchParams.toString();
};

const toAdminQueryString = (params: ListMatchesParams): string => {
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
};

export const listUpcomingMatches = async (
  params: ListUpcomingMatchesParams = {},
): Promise<MatchListResponse> => {
  const queryString = toUpcomingQueryString(params);
  const path = queryString
    ? `/matches/upcoming/?${queryString}`
    : "/matches/upcoming/";

  return apiFetch<MatchListResponse>(path, {
    method: "GET",
  });
};

export const listFinalMatches = async (
  params: ListUpcomingMatchesParams = {},
): Promise<MatchListResponse> => {
  const queryString = toUpcomingQueryString(params);
  const path = queryString
    ? `/matches/finals/?${queryString}`
    : "/matches/finals/";

  return apiFetch<MatchListResponse>(path, {
    method: "GET",
  });
};

export const listMatchResults = async (
  params: Pick<ListMatchesParams, "limit" | "offset"> = {},
): Promise<MatchListResponse> => {
  const searchParams = new URLSearchParams();

  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  const queryString = searchParams.toString();
  const path = queryString
    ? `/matches/results/?${queryString}`
    : "/matches/results/";

  return apiFetch<MatchListResponse>(path, {
    method: "GET",
  });
};

export const getHeadToHeadMatchHistory = async (
  matchId: number,
  params: { limit?: number } = {},
): Promise<HeadToHeadResponse> => {
  const searchParams = new URLSearchParams();

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  const queryString = searchParams.toString();
  const path = queryString
    ? `/matches/${matchId}/head-to-head?${queryString}`
    : `/matches/${matchId}/head-to-head`;

  return apiFetch<HeadToHeadResponse>(path, {
    method: "GET",
  });
};

export const getCurrentMatchDay = async (): Promise<MatchDayResponse> => {
  return authenticatedApiFetch<MatchDayResponse>("/matchday", {
    method: "GET",
  });
}

export const listMatches = async (
  params: ListMatchesParams = {},
): Promise<MatchListResponse> => {
  const queryString = toMatchQueryString(params);
  const path = queryString ? `/matches?${queryString}` : "/matches";

  return apiFetch<MatchListResponse>(path, {
    method: "GET",
  });
};

export const listAdminMatches = async (
  params: ListMatchesParams = {},
): Promise<MatchListResponse> => {
  const queryString = toAdminQueryString(params);
  const path = queryString ? `/admin/matches?${queryString}` : "/admin/matches";

  return authenticatedApiFetch<MatchListResponse>(path, {
    method: "GET",
  });
};

export const createMatch = async (data: MatchCreate): Promise<MatchResponse> => {
  return authenticatedApiFetch<MatchResponse, MatchCreate>("/admin/matches", {
    body: data,
    method: "POST",
  });
};

export const updateMatch = async (
  matchId: number,
  data: MatchUpdate,
): Promise<MatchResponse> => {
  return authenticatedApiFetch<MatchResponse, MatchUpdate>(
    `/admin/matches/${matchId}`,
    {
      body: data,
      method: "PUT",
    },
  );
};

export const deleteMatch = async (matchId: number): Promise<void> => {
  await authenticatedApiFetch<null>(`/admin/matches/${matchId}`, {
    method: "DELETE",
  });
};

export const matchService = {
  createMatch,
  deleteMatch,
  getHeadToHeadMatchHistory,
  listAdminMatches,
  listMatches,
  listMatchResults,
  listUpcomingMatches,
  updateMatch,
};
