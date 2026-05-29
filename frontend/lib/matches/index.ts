export {
  createMatch,
  deleteMatch,
  listAdminMatches,
  listUpcomingMatches,
  matchService,
  updateMatch,
} from "@/lib/matches/match-service";
export { GAME_DURATIONS } from "@/lib/matches/types";
export type {
  GameDuration,
  ListAdminMatchesParams,
  ListUpcomingMatchesParams,
  MatchCreate,
  MatchFields,
  MatchListResponse,
  MatchResponse,
  MatchUpdate,
} from "@/lib/matches/types";
