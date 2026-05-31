import { authenticatedApiFetch } from "@/lib/auth";
import type {
  LeaderboardResponse,
  ListLeaderboardParams,
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

export const leaderboardService = {
  listLeaderboard,
  getUserPredictionDetails,
};
