"""Score-only match prediction from H2H, history, tournament form, and rank."""

from __future__ import annotations

import math
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any

from app.models.match import Match, MatchStage

_SCORE_PAIR_RE = re.compile(r"(?<!\d)(\d{1,2})\s*(?:-|:|–|—)\s*(\d{1,2})(?!\d)")
_INTEGER_RE = re.compile(r"\d+")


@dataclass
class _TeamStats:
    """Weighted form stats for one team."""

    goals_for: float = 0.0
    goals_against: float = 0.0
    points: float = 0.0
    total_weight: float = 0.0
    matches: int = 0

    def add(self, *, goals_for: int, goals_against: int, weight: float) -> None:
        self.matches += 1
        self.total_weight += weight
        self.goals_for += goals_for * weight
        self.goals_against += goals_against * weight

        if goals_for > goals_against:
            self.points += 3 * weight
        elif goals_for == goals_against:
            self.points += weight

    @property
    def average_goals_for(self) -> float:
        if self.total_weight == 0:
            return 1.15
        return self.goals_for / self.total_weight

    @property
    def average_goals_against(self) -> float:
        if self.total_weight == 0:
            return 1.15
        return self.goals_against / self.total_weight

    @property
    def points_per_match(self) -> float:
        if self.total_weight == 0:
            return 1.0
        return self.points / self.total_weight


@dataclass(frozen=True)
class _SourceProjection:
    """Expected-goals projection from one evidence source."""

    key: str
    team1_expected_goals: float
    team2_expected_goals: float
    match_count: int
    label: str


@dataclass(frozen=True)
class MatchScorePrediction:
    """Score prediction plus normalized insight data."""

    team1_score: int | None
    team2_score: int | None
    summary: str
    source: str
    basis: list[str] = field(default_factory=list)
    h2h_results: list[dict[str, object]] = field(default_factory=list)
    team1_match_history: list[dict[str, object]] = field(default_factory=list)
    team2_match_history: list[dict[str, object]] = field(default_factory=list)


class MatchScorePredictionService:
    """Build deterministic score predictions from available match signals."""

    def predict(
        self,
        *,
        match: Match,
        insights: Mapping[str, Any] | None,
        completed_matches: Sequence[Match],
        limit: int,
    ) -> MatchScorePrediction:
        """Return a score-only prediction for a match."""
        normalized_insights = insights or {}
        h2h_results = self._normalize_h2h_results(
            normalized_insights.get("head_to_head")
            or normalized_insights.get("h2h_results")
            or normalized_insights.get("results")
            or [],
            limit=limit,
        )
        team1_history = self._normalize_team_history(
            normalized_insights.get("team1_match_history") or [],
            limit=limit,
        )
        team2_history = self._normalize_team_history(
            normalized_insights.get("team2_match_history") or [],
            limit=limit,
        )

        projections = {
            "h2h": self._project_from_h2h(h2h_results),
            "recent": self._project_from_recent_history(team1_history, team2_history),
            "tournament": self._project_from_tournament(match, completed_matches),
            "ranking": self._project_from_fifa_ranking(match),
        }
        projection_items = {
            key: projection
            for key, projection in projections.items()
            if projection is not None
        }

        team1_expected, team2_expected, source, basis = self._combine_projections(
            projection_items,
        )
        team1_score, team2_score = self._expected_goals_to_score(
            team1_expected_goals=team1_expected,
            team2_expected_goals=team2_expected,
            match_stage=match.match_stage,
        )

        return MatchScorePrediction(
            team1_score=team1_score,
            team2_score=team2_score,
            summary=self._build_summary(
                match=match,
                team1_score=team1_score,
                team2_score=team2_score,
                source=source,
                basis=basis,
            ),
            source=source,
            basis=basis,
            h2h_results=h2h_results,
            team1_match_history=team1_history,
            team2_match_history=team2_history,
        )

    @staticmethod
    def _normalize_h2h_results(
        items: Any,
        *,
        limit: int,
    ) -> list[dict[str, object]]:
        if not isinstance(items, list):
            return []

        results: list[dict[str, object]] = []
        for item in items[:limit]:
            if not isinstance(item, Mapping):
                continue

            score_pair = (
                _parse_score_pair(item.get("score"))
                or _parse_score_pair(item.get("team1_score"))
                or _parse_score_pair(item.get("team2_score"))
            )
            team1_score = _coerce_score(item.get("team1_score"))
            team2_score = _coerce_score(item.get("team2_score"))
            if (team1_score is None or team2_score is None) and score_pair:
                team1_score, team2_score = score_pair

            if team1_score is None or team2_score is None:
                continue

            results.append(
                {
                    "date": _optional_string(item.get("date")),
                    "team1_score": team1_score,
                    "team2_score": team2_score,
                    "result": str(item.get("result") or ""),
                },
            )

        return results

    @staticmethod
    def _normalize_team_history(
        items: Any,
        *,
        limit: int,
    ) -> list[dict[str, object]]:
        if not isinstance(items, list):
            return []

        history: list[dict[str, object]] = []
        for item in items[:limit]:
            if not isinstance(item, Mapping):
                continue

            score_text = str(item.get("score") or "")
            score_pair = _parse_score_pair(score_text)
            if score_pair is None:
                continue

            goals_for, goals_against = _orient_history_score(
                score_pair=score_pair,
                result=item.get("result"),
            )
            history.append(
                {
                    "date": _optional_string(item.get("date")),
                    "opponent": str(item.get("opponent") or ""),
                    "score": score_text,
                    "result": str(item.get("result") or ""),
                    "goals_for": goals_for,
                    "goals_against": goals_against,
                },
            )

        return history

    @staticmethod
    def _project_from_h2h(
        h2h_results: list[dict[str, object]],
    ) -> _SourceProjection | None:
        if not h2h_results:
            return None

        team1_stats = _TeamStats()
        team2_stats = _TeamStats()
        for index, result in enumerate(h2h_results):
            team1_score = int(result["team1_score"])
            team2_score = int(result["team2_score"])
            weight = _recency_weight(index)
            team1_stats.add(
                goals_for=team1_score,
                goals_against=team2_score,
                weight=weight,
            )
            team2_stats.add(
                goals_for=team2_score,
                goals_against=team1_score,
                weight=weight,
            )

        return _SourceProjection(
            key="h2h",
            team1_expected_goals=team1_stats.average_goals_for,
            team2_expected_goals=team2_stats.average_goals_for,
            match_count=len(h2h_results),
            label=f"H2H: {len(h2h_results)} match{'es' if len(h2h_results) != 1 else ''}",
        )

    @staticmethod
    def _project_from_recent_history(
        team1_history: list[dict[str, object]],
        team2_history: list[dict[str, object]],
    ) -> _SourceProjection | None:
        team1_stats = _stats_from_history(team1_history)
        team2_stats = _stats_from_history(team2_history)

        if team1_stats.matches == 0 and team2_stats.matches == 0:
            return None

        if team1_stats.matches > 0 and team2_stats.matches > 0:
            team1_expected = (
                team1_stats.average_goals_for + team2_stats.average_goals_against
            ) / 2
            team2_expected = (
                team2_stats.average_goals_for + team1_stats.average_goals_against
            ) / 2
        elif team1_stats.matches > 0:
            team1_expected = team1_stats.average_goals_for
            team2_expected = team1_stats.average_goals_against
        else:
            team1_expected = team2_stats.average_goals_against
            team2_expected = team2_stats.average_goals_for

        match_count = team1_stats.matches + team2_stats.matches
        return _SourceProjection(
            key="recent",
            team1_expected_goals=team1_expected,
            team2_expected_goals=team2_expected,
            match_count=match_count,
            label=f"recent history: {match_count} team result{'s' if match_count != 1 else ''}",
        )

    @staticmethod
    def _project_from_tournament(
        match: Match,
        completed_matches: Sequence[Match],
    ) -> _SourceProjection | None:
        team1_stats = _TeamStats()
        team2_stats = _TeamStats()

        for completed_match in completed_matches:
            if completed_match.id == match.id:
                continue
            if completed_match.team1_score is None or completed_match.team2_score is None:
                continue

            weight = 1.0
            if completed_match.team1_id == match.team1_id:
                team1_stats.add(
                    goals_for=completed_match.team1_score,
                    goals_against=completed_match.team2_score,
                    weight=weight,
                )
            elif completed_match.team2_id == match.team1_id:
                team1_stats.add(
                    goals_for=completed_match.team2_score,
                    goals_against=completed_match.team1_score,
                    weight=weight,
                )

            if completed_match.team1_id == match.team2_id:
                team2_stats.add(
                    goals_for=completed_match.team1_score,
                    goals_against=completed_match.team2_score,
                    weight=weight,
                )
            elif completed_match.team2_id == match.team2_id:
                team2_stats.add(
                    goals_for=completed_match.team2_score,
                    goals_against=completed_match.team1_score,
                    weight=weight,
                )

        if team1_stats.matches == 0 and team2_stats.matches == 0:
            return None

        if team1_stats.matches > 0 and team2_stats.matches > 0:
            team1_expected = (
                team1_stats.average_goals_for + team2_stats.average_goals_against
            ) / 2
            team2_expected = (
                team2_stats.average_goals_for + team1_stats.average_goals_against
            ) / 2
        elif team1_stats.matches > 0:
            team1_expected = team1_stats.average_goals_for
            team2_expected = team1_stats.average_goals_against
        else:
            team1_expected = team2_stats.average_goals_against
            team2_expected = team2_stats.average_goals_for

        match_count = team1_stats.matches + team2_stats.matches
        return _SourceProjection(
            key="tournament",
            team1_expected_goals=team1_expected,
            team2_expected_goals=team2_expected,
            match_count=match_count,
            label=f"current tournament: {match_count} team result{'s' if match_count != 1 else ''}",
        )

    @staticmethod
    def _project_from_fifa_ranking(match: Match) -> _SourceProjection:
        rank1 = _valid_rank(getattr(match.team1, "fifa_rank", None))
        rank2 = _valid_rank(getattr(match.team2, "fifa_rank", None))
        if rank1 is None or rank2 is None:
            return _SourceProjection(
                key="ranking",
                team1_expected_goals=1.15,
                team2_expected_goals=1.15,
                match_count=0,
                label="FIFA ranking: neutral",
            )

        rank_delta = _clamp((rank2 - rank1) / 80, -0.75, 0.75)
        expected_total_goals = 2.35 + abs(rank_delta) * 0.25
        return _SourceProjection(
            key="ranking",
            team1_expected_goals=expected_total_goals / 2 + rank_delta * 0.75,
            team2_expected_goals=expected_total_goals / 2 - rank_delta * 0.75,
            match_count=0,
            label="FIFA ranking",
        )

    @staticmethod
    def _combine_projections(
        projections: Mapping[str, _SourceProjection],
    ) -> tuple[float, float, str, list[str]]:
        # Priority order:
        #  1. H2H  — highest weight (primary signal)
        #  2. Recent match history — 2nd highest weight
        #  3. Tournament form — supporting signal
        #  4. FIFA ranking — weakest supporting signal
        # Fallback: when neither H2H nor recent history are available,
        #            use tournament form + FIFA ranking only.
        h2h_available = "h2h" in projections
        recent_available = "recent" in projections

        if h2h_available:
            # H2H leads; recent history provides meaningful second signal.
            weights = {
                "h2h": 0.50,
                "recent": 0.30,
                "tournament": 0.12,
                "ranking": 0.08,
            }
            source = "h2h"
        elif recent_available:
            # No H2H — recent form is the primary driver.
            weights = {
                "recent": 0.65,
                "tournament": 0.22,
                "ranking": 0.13,
            }
            source = "recent_history"
        elif "tournament" in projections:
            # Neither H2H nor recent history available — fall back to
            # current tournament performance + FIFA ranking only.
            weights = {
                "tournament": 0.72,
                "ranking": 0.28,
            }
            source = "tournament_and_ranking"
        else:
            weights = {"ranking": 1.0}
            source = "fifa_ranking"

        total_weight = sum(
            weight
            for key, weight in weights.items()
            if key in projections
        )
        if total_weight <= 0:
            ranking_projection = projections["ranking"]
            return (
                ranking_projection.team1_expected_goals,
                ranking_projection.team2_expected_goals,
                "fifa_ranking",
                [ranking_projection.label],
            )

        team1_expected = 0.0
        team2_expected = 0.0
        basis: list[str] = []
        for key, weight in weights.items():
            projection = projections.get(key)
            if projection is None:
                continue

            normalized_weight = weight / total_weight
            team1_expected += projection.team1_expected_goals * normalized_weight
            team2_expected += projection.team2_expected_goals * normalized_weight
            basis.append(projection.label)

        return team1_expected, team2_expected, source, basis

    @staticmethod
    def _expected_goals_to_score(
        *,
        team1_expected_goals: float,
        team2_expected_goals: float,
        match_stage: MatchStage | str | None,
    ) -> tuple[int, int]:
        team1_expected = _clamp(team1_expected_goals, 0.15, 4.8)
        team2_expected = _clamp(team2_expected_goals, 0.15, 4.8)
        team1_score = _round_goal(team1_expected)
        team2_score = _round_goal(team2_expected)
        expected_total = team1_expected + team2_expected

        if team1_score == 0 and team2_score == 0 and expected_total >= 1.55:
            if team1_expected >= team2_expected:
                team1_score = 1
            else:
                team2_score = 1

        expected_delta = team1_expected - team2_expected
        if team1_score == team2_score and abs(expected_delta) >= 0.38:
            if expected_delta > 0:
                team1_score = min(team1_score + 1, 6)
            else:
                team2_score = min(team2_score + 1, 6)

        if team1_score == team2_score and not _is_group_stage(match_stage):
            if expected_delta >= 0:
                team1_score = min(team1_score + 1, 6)
            else:
                team2_score = min(team2_score + 1, 6)

        return _clamp_int(team1_score, 0, 6), _clamp_int(team2_score, 0, 6)

    @staticmethod
    def _build_summary(
        *,
        match: Match,
        team1_score: int,
        team2_score: int,
        source: str,
        basis: list[str],
    ) -> str:
        team1_name = getattr(match.team1, "name", "Team 1").replace("-H", "").replace("-A", "")
        team2_name = getattr(match.team2, "name", "Team 2").replace("-H", "").replace("-A", "")
        source_text = {
            "h2h": "H2H (highest weight) + recent history + tournament form + FIFA ranking",
            "recent_history": "recent match history (highest weight) + tournament form + FIFA ranking",
            "tournament_and_ranking": "tournament form + FIFA ranking (H2H and match history unavailable)",
            "fifa_ranking": "FIFA ranking only",
        }.get(source, source.replace("_", " "))
        basis_text = ", ".join(basis)
        if basis_text:
            return (
                f"AI score pick: {team1_name} {team1_score}-{team2_score} "
                f"{team2_name} — {source_text} ({basis_text})."
            )

        return (
            f"AI score pick: {team1_name} {team1_score}-{team2_score} "
            f"{team2_name} — {source_text}."
        )


def _stats_from_history(history: list[dict[str, object]]) -> _TeamStats:
    stats = _TeamStats()
    for index, item in enumerate(history):
        goals_for = _coerce_score(item.get("goals_for"))
        goals_against = _coerce_score(item.get("goals_against"))
        if goals_for is None or goals_against is None:
            continue

        stats.add(
            goals_for=goals_for,
            goals_against=goals_against,
            weight=_recency_weight(index),
        )

    return stats


def _recency_weight(index: int) -> float:
    return max(0.45, 1.0 - index * 0.08)


def _orient_history_score(
    *,
    score_pair: tuple[int, int],
    result: Any,
) -> tuple[int, int]:
    goals_for, goals_against = score_pair
    result_text = str(result or "").strip().lower()

    is_win = result_text in {"w", "win", "won"} or result_text.startswith("win")
    is_loss = result_text in {"l", "loss", "lost"} or result_text.startswith("loss")

    if is_win and goals_for < goals_against:
        return goals_against, goals_for
    if is_loss and goals_for > goals_against:
        return goals_against, goals_for

    return goals_for, goals_against


def _parse_score_pair(value: Any) -> tuple[int, int] | None:
    if value is None:
        return None

    match = _SCORE_PAIR_RE.search(str(value))
    if match is None:
        return None

    return int(match.group(1)), int(match.group(2))


def _coerce_score(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value >= 0 else None
    if isinstance(value, float) and value.is_integer():
        return int(value) if value >= 0 else None

    text = str(value).strip()
    if not text:
        return None
    if text.isdigit():
        return int(text)

    match = _INTEGER_RE.search(text)
    if match is None:
        return None

    return int(match.group(0))


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip()
    return text or None


def _valid_rank(value: Any) -> int | None:
    rank = _coerce_score(value)
    if rank is None or rank <= 0:
        return None

    return rank


def _round_goal(value: float) -> int:
    return _clamp_int(math.floor(value + 0.5), 0, 6)


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def _clamp_int(value: int, minimum: int, maximum: int) -> int:
    return min(maximum, max(minimum, value))


def _is_group_stage(match_stage: MatchStage | str | None) -> bool:
    if match_stage is None:
        return True
    if isinstance(match_stage, MatchStage):
        return match_stage == MatchStage.GROUP

    return str(match_stage) == MatchStage.GROUP.value
