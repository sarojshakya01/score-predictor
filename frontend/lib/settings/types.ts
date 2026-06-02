// ── Core setting types ────────────────────────────────────────────────────────

/** A single scoring line within a rule group. */
export type GameRuleEntry = {
  order: number;
  points: number;
  instruction: string;
};

/** A named category of scoring rules (e.g. score, yellow_card). */
export type GameRuleGroup = {
  name: string;
  friend_name: string;
  order: number;
  rules: GameRuleEntry[];
};

/** Shape of the `value` field for the `game_rules` setting. */
export type GameRulesValue = {
  rules: GameRuleGroup[];
};

/** Shape of the `value` field for the `current_match_day` setting. */
export type MatchDayValue = {
  day: number;
};

// ── API response types ────────────────────────────────────────────────────────

export type SettingResponse = {
  created_at: string;
  id: number;
  name: string;
  friendly_name: string;
  updated_at: string;
  /** JSON value — shape depends on the setting name. */
  value: Record<string, unknown>;
};

export type SettingListResponse = {
  items: SettingResponse[];
  limit: number;
  offset: number;
  total: number;
};

export type SettingCreate = {
  name: string;
  friendly_name: string;
  value: Record<string, unknown>;
};

export type SettingUpdate = Partial<SettingCreate>;

export type ListSettingsParams = {
  limit?: number;
  offset?: number;
  search?: string;
};

export type MatchDayResponse = {
  value: number;
};

export type GameRulesResponse = {
  rules: GameRuleGroup[];
};

// ── Typed value helpers ───────────────────────────────────────────────────────

/** Narrow a setting's value as a GameRulesValue. Returns null if the shape is wrong. */
export const asGameRulesValue = (value: Record<string, unknown>): GameRulesValue | null => {
  if (!Array.isArray(value.rules)) return null;
  return value as unknown as GameRulesValue;
};

/** Narrow a setting's value as a MatchDayValue. Returns null if the shape is wrong. */
export const asMatchDayValue = (value: Record<string, unknown>): MatchDayValue | null => {
  if (typeof value.day !== "number") return null;
  return value as unknown as MatchDayValue;
};
