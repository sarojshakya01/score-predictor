import { authenticatedApiFetch } from "@/lib/auth";
import type {
  LeaderboardResponse,
  ListLeaderboardParams,
  MatchPointsDetailsResponse,
  UserPointsDetailsListResponse,
} from "@/lib/leaderboard/types";

const toQueryString = (params: ListLeaderboardParams): string => {
  const searchParams = new URLSearchParams();

  if (params.offset !== undefined) {
    searchParams.set("offset", String(params.offset));
  }

  if (params.limit !== undefined) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.is_race_data_required !== undefined) {
    searchParams.set("is_race_data_required", String(params.is_race_data_required));
  }

  return searchParams.toString();
};

export const listLeaderboard = async (
  params: ListLeaderboardParams = {},
): Promise<LeaderboardResponse> => {
  const queryString = toQueryString(params);
  const path = queryString ? `/leaderboard?${queryString}` : "/leaderboard";

  return authenticatedApiFetch<LeaderboardResponse>(path, {
    method: "GET",
  });
};

export const getUserPredictionDetails = async (
  userId: number,
): Promise<UserPointsDetailsListResponse> => {
  return authenticatedApiFetch<UserPointsDetailsListResponse>(
    `/leaderboard/users/${userId}/points-details`,
    { method: "GET" },
  );
};

export const getMatchPointsDetails = async (
  matchId: number,
): Promise<MatchPointsDetailsResponse> => {
  return authenticatedApiFetch<MatchPointsDetailsResponse>(
    `/leaderboard/matches/${matchId}/points-details`,
    { method: "GET" },
  );
};

export const leaderboardService = {
  getMatchPointsDetails,
  listLeaderboard,
  getUserPredictionDetails,
};
