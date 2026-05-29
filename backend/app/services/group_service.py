"""Group standings business logic."""

import logging
from dataclasses import dataclass

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.match import Match
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
                        for standing in sorted(
                            standings.values(),
                            key=self._standing_sort_key,
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
    ) -> tuple[int, int, int, str]:
        """Sort by points, goal difference, goals scored, then team name."""
        return (
            -standing.points,
            -standing.goal_difference,
            -standing.goals_for,
            standing.team,
        )
