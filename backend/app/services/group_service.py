"""Group standings business logic."""

import logging
from collections import defaultdict
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match, MatchStage
from app.models.team import Team
from app.repositories.match_repository import MatchRepository
from app.repositories.team_repository import TeamRepository
from app.schemas.group import (
    GroupStandingResponse,
    GroupTableListResponse,
    GroupTableResponse,
)
from app.services.team_service import TeamService

logger = logging.getLogger(__name__)


@dataclass
class StandingTotals:
    """Mutable totals used while calculating a group table."""

    team_id: int
    team: str
    fifa_code: str
    flag_url: str
    fifa_rank: int = 0
    played: int = 0
    won: int = 0
    drawn: int = 0
    lost: int = 0
    goals_for: int = 0
    goals_against: int = 0
    points: int = 0

    @property
    def goal_difference(self) -> int:
        """Return goals scored minus goals conceded."""
        return self.goals_for - self.goals_against

    def to_response(self) -> GroupStandingResponse:
        """Convert accumulated totals to an API response schema."""
        return GroupStandingResponse(
            team_id=self.team_id,
            team=self.team,
            fifa_code=self.fifa_code,
            fifa_rank=self.fifa_rank,
            flag_url=self.flag_url,
            played=self.played,
            won=self.won,
            drawn=self.drawn,
            lost=self.lost,
            goals_for=self.goals_for,
            goals_against=self.goals_against,
            goal_difference=self.goal_difference,
            points=self.points,
        )


@dataclass
class HeadToHeadTotals:
    """Totals from matches between teams tied on points."""

    points: int = 0
    goals_for: int = 0
    goals_against: int = 0

    @property
    def goal_difference(self) -> int:
        """Return head-to-head goals scored minus conceded."""
        return self.goals_for - self.goals_against


class GroupService:
    """Builds group-stage tables from teams and completed group matches."""

    def __init__(self, db: AsyncSession) -> None:
        self._match_repository = MatchRepository(db)
        self._team_repository = TeamRepository(db)

    async def list_group_tables(self) -> GroupTableListResponse:
        """Return every group with teams ordered by current standings."""
        try:
            teams = await self._team_repository.list_all_teams()
            matches = await self._match_repository.list_completed_matches()

            groups = self._initialize_groups(teams)
            self._apply_match_results(groups=groups, matches=matches)

            group_tables = [
                GroupTableResponse(
                    group=group_name,
                    standings=[
                        standing.to_response()
                        for standing in self._sort_group_standings(
                            standings=list(standings.values()),
                            matches=matches,
                        )
                    ],
                )
                for group_name, standings in groups.items()
            ]

            return GroupTableListResponse(
                items=group_tables,
                total=len(group_tables),
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Unexpected error during list_group_tables:", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not list group tables",
            )

    @staticmethod
    def _initialize_groups(
        teams: list[Team],
    ) -> dict[str, dict[int, StandingTotals]]:
        """Create empty standings for every known team."""
        groups: dict[str, dict[int, StandingTotals]] = {}

        for team in teams:
            group_standings = groups.setdefault(team.group, {})
            group_standings[team.id] = StandingTotals(
                team_id=team.id,
                team=team.name,
                fifa_code=team.fifa_code,
                fifa_rank=team.fifa_rank,
                flag_url=TeamService.flag_base_url + team.fifa_code,
            )

        return groups

    @staticmethod
    def _apply_match_results(
        *,
        groups: dict[str, dict[int, StandingTotals]],
        matches: list[Match],
    ) -> None:
        """Apply completed same-group match results to standings."""
        for match in matches:
            if (
                match.team1_score is None
                or match.team2_score is None
                or not GroupService._is_group_stage_match(match)
                or match.team1.group != match.team2.group
            ):
                continue

            group_standings = groups.get(match.team1.group)
            if group_standings is None:
                continue

            team1_standing = group_standings.get(match.team1_id)
            team2_standing = group_standings.get(match.team2_id)
            if team1_standing is None or team2_standing is None:
                continue

            GroupService._apply_team_result(
                standing=team1_standing,
                goals_for=match.team1_score,
                goals_against=match.team2_score,
            )
            GroupService._apply_team_result(
                standing=team2_standing,
                goals_for=match.team2_score,
                goals_against=match.team1_score,
            )

    @staticmethod
    def _apply_team_result(
        *,
        standing: StandingTotals,
        goals_for: int,
        goals_against: int,
    ) -> None:
        """Update one team's totals for a completed match."""
        standing.played += 1
        standing.goals_for += goals_for
        standing.goals_against += goals_against

        if goals_for > goals_against:
            standing.won += 1
            standing.points += 3
        elif goals_for == goals_against:
            standing.drawn += 1
            standing.points += 1
        else:
            standing.lost += 1

    @staticmethod
    def _standing_sort_key(
        standing: StandingTotals,
    ) -> tuple[int, int, str]:
        """Sort by goal difference, goals scored, then team name."""
        return (
            -standing.goal_difference,
            -standing.goals_for,
            standing.team,
        )

    @staticmethod
    def _sort_group_standings(
        *,
        standings: list[StandingTotals],
        matches: list[Match],
    ) -> list[StandingTotals]:
        """Sort group standings with head-to-head before goal difference."""
        standings_by_points: dict[int, list[StandingTotals]] = defaultdict(list)
        for standing in standings:
            standings_by_points[standing.points].append(standing)

        sorted_standings: list[StandingTotals] = []
        for points in sorted(standings_by_points.keys(), reverse=True):
            tied_standings = standings_by_points[points]
            if len(tied_standings) == 1:
                sorted_standings.extend(tied_standings)
                continue

            head_to_head = GroupService._calculate_head_to_head_totals(
                team_ids={standing.team_id for standing in tied_standings},
                matches=matches,
            )
            sorted_standings.extend(
                sorted(
                    tied_standings,
                    key=lambda standing: GroupService._tied_standing_sort_key(
                        standing=standing,
                        head_to_head=head_to_head[standing.team_id],
                    ),
                ),
            )

        return sorted_standings

    @staticmethod
    def _tied_standing_sort_key(
        *,
        standing: StandingTotals,
        head_to_head: HeadToHeadTotals,
    ) -> tuple[int, int, int, int, int, str]:
        """Sort tied teams by head-to-head before overall goal difference."""
        return (
            -head_to_head.points,
            -head_to_head.goal_difference,
            -head_to_head.goals_for,
            *GroupService._standing_sort_key(standing),
        )

    @staticmethod
    def _calculate_head_to_head_totals(
        *,
        team_ids: set[int],
        matches: list[Match],
    ) -> dict[int, HeadToHeadTotals]:
        """Build a mini-table from matches between tied teams."""
        head_to_head = {team_id: HeadToHeadTotals() for team_id in team_ids}

        for match in matches:
            if (
                match.team1_score is None
                or match.team2_score is None
                or not GroupService._is_group_stage_match(match)
                or match.team1_id not in team_ids
                or match.team2_id not in team_ids
            ):
                continue

            GroupService._apply_head_to_head_result(
                totals=head_to_head[match.team1_id],
                goals_for=match.team1_score,
                goals_against=match.team2_score,
            )
            GroupService._apply_head_to_head_result(
                totals=head_to_head[match.team2_id],
                goals_for=match.team2_score,
                goals_against=match.team1_score,
            )

        return head_to_head

    @staticmethod
    def _apply_head_to_head_result(
        *,
        totals: HeadToHeadTotals,
        goals_for: int,
        goals_against: int,
    ) -> None:
        """Update one team's head-to-head totals."""
        totals.goals_for += goals_for
        totals.goals_against += goals_against

        if goals_for > goals_against:
            totals.points += 3
        elif goals_for == goals_against:
            totals.points += 1

    @staticmethod
    def _is_group_stage_match(match: Match) -> bool:
        """Return true when a match should count toward group standings."""
        if match.match_stage is None:
            return True
        if isinstance(match.match_stage, MatchStage):
            return match.match_stage == MatchStage.GROUP

        return str(match.match_stage) == MatchStage.GROUP.value
