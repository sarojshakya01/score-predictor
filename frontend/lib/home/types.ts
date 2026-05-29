export type HomeNextLockResponse = {
  label: string;
  lock_datetime: string;
  match_id: number;
  minutes_until_lock: number;
};

export type HomeSummaryResponse = {
  completed_matches: number;
  locking_soon: number;
  next_lock: HomeNextLockResponse | null;
  open_matches: number;
  predictions_made: number;
};
