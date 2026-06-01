import { FirstGoalIn, MatchDuration, MatchStage } from "./types";

export const firstGoalIns = ["1H", "2H", "ET"] as const;
export const firstGoalInLabels: Record<FirstGoalIn, string> = {
    "1H": "First Half",
    "2H": "Second Half",
    ET: "Extra Time",
};

export const matchDurations = ["90", "120", "PENALTY"] as const;
export const matchDurationLabels: Record<MatchDuration, string> = {
    "90": "90 minutes",
    "120": "120 minutes",
    PENALTY: "Penalty",
};

export const matchStages = [
    "GROUP",
    "R32",
    "R16",
    "QF",
    "SF",
    "3P",
    "F",
] as const;
export const matchStageLabels: Record<MatchStage, string> = {
    "GROUP": "Group Stage",
    "R32": "Round of 32",
    "R16": "Round of 16",
    "QF": "Quarter Final",
    "SF": "Semi Final",
    "3P": "Third Place",
    "F": "Final",
};
