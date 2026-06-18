"""
APScheduler-based automation for the Match Predictor backend.

Five scheduled jobs:
  1. extract_live_match_data   – every 2 min   – polls UEFA livescore API and
                                                 updates match scores / stats in DB
  2. send_autolock_email       – every 5 min   – locks matches ≤60 min away and
                                                 emails predictions summary to all users
  3. send_reminder_email       – every 30 min  – emails users who have not yet
                                                 predicted for matches within 3 hours
  4. update_current_match_day  – every 4 hours – sets the current_match_day setting
                                                 to the next upcoming match day
  5. send_todays_matches_email – daily 07:00   – morning digest of today's matches

Usage
-----
The scheduler is started/stopped automatically as a FastAPI lifespan event.
Register it in app/main.py:

    from app.workers.scheduler import lifespan
    app = FastAPI(..., lifespan=lifespan)
"""
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta, timezone
from html import escape
from typing import AsyncGenerator

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import async_session_factory
from app.models.match import MATCH_DETAILS_ENDPOINT, Match, MatchDuration, MatchStage
from app.models.prediction import Prediction
from app.models.setting import Setting
from app.models.team import Team
from app.models.user import User, UserRole
from app.services.email_service import build_base_html, send_email

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

UEFA_LIVESCORE_ENDPOINT = "https://match.uefa.com/v5/livescore?competitionId=3"
UEFA_STATS_ENDPOINT = "https://matchstats.uefa.com/v1/team-statistics/"
COMPETITIONS_NAME = "FIFA World Cup™"
SEASON_NAME = "FIFA World Cup 2026™"
RANKING_ENDPOINT = "https://api.fifa.com/api/v3/fifarankings/rankings/live?gender=1&sportType=0&language=en"
FIFA_LIVE_MATCH_ENDPOINT = "https://api.fifa.com/api/v3/live/football"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/91.0.4472.124 Safari/537.36"
    ),
    "Content-Type": "application/json",
}

_FIRST_GOAL_IN_LABELS: dict[str, str] = {
    "1H": "1st Half",
    "2H": "2nd Half",
    "ET": "Extra Time",
}

_DURATION_LABELS: dict[str, str] = {
    "90": "90 min",
    "120": "120 min",
    "PENALTY": "Penalties",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_value(value: str | None) -> str:
    if value is None:
        return "—"
    return value

def _fmt_first_goal_in(value: str | None) -> str:
    if value is None:
        return "—"
    return _FIRST_GOAL_IN_LABELS.get(value, value)

def _fmt_duration(value: str | None) -> str:
    if value is None:
        return "—"
    return _DURATION_LABELS.get(value, value)


def _fmt_bool(value: bool | None) -> str:
    if value is None:
        return "—"
    return "Yes" if value else "No"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _fmt_user_name(user: User) -> str:
    return escape(f"{user.first_name} {user.last_name}".strip())


def _user_name_sort_key(user: User) -> tuple[str, str, int]:
    return (user.first_name.casefold(), user.last_name.casefold(), user.id)


def _fmt_team_prediction(team_by_id: dict[int, Team], team_id: int | None) -> str:
    if team_id is None:
        return "Not selected"

    team = team_by_id.get(team_id)
    if team is None:
        return "Unknown team"

    return escape(team.name)


def _has_final_winners_prediction(user: User) -> bool:
    return (
        user.winner_team_id is not None
        and user.runner_up_team_id is not None
        and user.third_place_team_id is not None
    )


async def _list_prediction_users(db: AsyncSession) -> list[User]:
    user_result = await db.execute(
        select(User)
        .where(
            (User.is_active.is_(True)) &
            (User.role != UserRole.ADMIN)
        )
        .order_by(User.first_name.asc(), User.last_name.asc(), User.id.asc()),
    )
    return list(user_result.scalars().all())


async def _get_team_by_id_for_users(db: AsyncSession, users: list[User]) -> dict[int, Team]:
    team_ids = {
        team_id
        for user in users
        for team_id in (
            user.winner_team_id,
            user.runner_up_team_id,
            user.third_place_team_id,
        )
        if team_id is not None
    }
    if not team_ids:
        return {}

    team_result = await db.execute(
        select(Team).where(Team.id.in_(team_ids)),
    )
    return {team.id: team for team in team_result.scalars().all()}


async def _send_final_winners_reminder_email(match_day: int, db: AsyncSession, now: datetime) -> None:
    users = await _list_prediction_users(db)
    recipients = [user.email for user in users]

    if not recipients:
        logger.info("[JOB2] No active users – skipping final winners reminder email")
        return

    rows_html = ""
    for idx, user in enumerate(users, start=1):
        predicted = _has_final_winners_prediction(user)
        status_class = "" if predicted else "not-predicted"
        status_text = "✓ Yes" if predicted else "✗ No"
        rows_html += (
            f"<tr>"
            f"<td>{idx}</td>"
            f"<td>{_fmt_user_name(user)}</td>"
            f"<td class='{status_class}'>{status_text}</td>"
            f"</tr>"
        )

    table_html = (
        f"<table>"
        f"<thead>"
        f"<tr><th colspan='3'>Final Winners Prediction Status</th></tr>"
        f"<tr><th>#</th><th>Player</th><th>Predicted?</th></tr>"
        f"</thead>"
        f"<tbody>{rows_html}</tbody>"
        f"</table>"
    )

    body = build_base_html(
        f"<p>Dear all,</p>"
        f"<p>Match day {match_day} has arrived. Please submit your final winners "
        f"predictions before the match day 8 deadline.</p>"
        f"{table_html}"
    )

    subject = (
        "World Cup 2026 – Final Winners Prediction Reminder "
        f"({now.strftime('%Y-%m-%d')})"
    )
    await send_email(
        subject=subject,
        html_body=body,
        recipients=recipients,
    )


async def _send_final_winners_predictions_email(db: AsyncSession, now: datetime) -> None:
    users = await _list_prediction_users(db)
    recipients = [user.email for user in users]

    if not recipients:
        logger.info("[JOB2] No active users – skipping final winners predictions email")
        return

    team_by_id = await _get_team_by_id_for_users(db, users)
    rows_html = ""
    for idx, user in enumerate(users, start=1):
        predicted = _has_final_winners_prediction(user)
        status_class = "" if predicted else "not-predicted"
        rows_html += (
            f"<tr>"
            f"<td>{idx}</td>"
            f"<td>{_fmt_user_name(user)}</td>"
            f"<td class='{status_class}'>{_fmt_team_prediction(team_by_id, user.winner_team_id)}</td>"
            f"<td class='{status_class}'>{_fmt_team_prediction(team_by_id, user.runner_up_team_id)}</td>"
            f"<td class='{status_class}'>{_fmt_team_prediction(team_by_id, user.third_place_team_id)}</td>"
            f"</tr>"
        )

    table_html = (
        f"<table>"
        f"<thead>"
        f"<tr><th colspan='5'>Final Winners Predictions</th></tr>"
        f"<tr><th>#</th><th>Player</th><th>Winner</th>"
        f"<th>Runner-up</th><th>Third Place</th></tr>"
        f"</thead>"
        f"<tbody>{rows_html}</tbody>"
        f"</table>"
    )

    body = build_base_html(
        f"<p>Dear all,</p>"
        f"<p>Final winners predictions submitted by all active users are listed below.</p>"
        f"{table_html}"
    )

    subject = (
        "World Cup 2026 – Final Winners Predictions "
        f"({now.strftime('%Y-%m-%d')})"
    )
    await send_email(
        subject=subject,
        html_body=body,
        recipients=recipients,
    )


async def _send_final_winners_match_day_email_if_needed(
    db: AsyncSession,
    *,
    match_day: int,
    now: datetime,
) -> None:
    if match_day == 6 or match_day == 7:
        await _send_final_winners_reminder_email(match_day, db, now)
    elif match_day == 8:
        await _send_final_winners_predictions_email(db, now)


# ═════════════════════════════════════════════════════════════════════════════
# JOB 1 – Live match data extraction
# ═════════════════════════════════════════════════════════════════════════════

async def extract_live_match_data_uefa() -> None:
    """
    Poll the UEFA livescore API every settings.LIVE_MATH_UPDATE_INTERVAL_MIN minutes.

    For each locked match currently in-play (started within the last 140 minutes):
      • fetch live score from the livescore endpoint
      • fetch per-team card stats from the team-statistics endpoint
      • update team1_score, team2_score, yellow_card_count, red_card_count in DB
    """
    logger.info("[JOB1] extract_live_match_data – starting")

    window_start = _now_utc() - timedelta(minutes=140)
    window_end = _now_utc()

    async with async_session_factory() as db:
        # Fetch locked matches that could be live right now
        result = await db.execute(
            select(Match)
            .options(selectinload(Match.team1), selectinload(Match.team2))
            .where(Match.match_locked.is_(True))
            .where(Match.match_datetime <= window_end)
            .where(Match.match_datetime >= window_start)
            .order_by(Match.match_datetime.asc(), Match.id.asc()),
        )
        active_matches: list[Match] = list(result.scalars().all())

        if not active_matches:
            logger.info("[JOB1] No active matches in the live window – nothing to do")
            return

        logger.info("[JOB1] %d active match(es) found", len(active_matches))

        async with httpx.AsyncClient(timeout=15) as client:
            # ── Fetch livescore ───────────────────────────────────────────────
            try:
                resp = await client.get(UEFA_LIVESCORE_ENDPOINT, headers=HEADERS)
                resp.raise_for_status()
            except Exception:
                logger.exception("[JOB1] Failed to fetch livescore data")
                return

            live_entries: list[dict] = []
            for item in resp.json():
                status = item.get("status")
                if status in ("LIVE", "FINISHED"):
                    live_entries.append(
                        {
                            "match_id": item["id"],
                            "status": status,
                            "score": item.get("score", {}).get("total", {"home": 0, "away": 0}),
                            "minute": int(
                                item.get("minute", {}).get("normal", 999)
                            ),
                        }
                    )
                    logger.info(
                        "[JOB1] UEFA match %s status=%s min=%s",
                        item["id"],
                        status,
                        item.get("minute", {}).get("normal", "?"),
                    )

            if not live_entries:
                logger.info("[JOB1] Livescore API returned no LIVE/FINISHED matches")
                return

            # Prefer LIVE over FINISHED when both appear (same as legacy script)
            if len(live_entries) >= 2:
                live_only = [e for e in live_entries if e["status"] == "LIVE"]
                if live_only:
                    live_entries = live_only

            # ── Match UEFA entries to our DB rows by position ─────────────────
            paired = list(zip(active_matches, live_entries))

            for db_match, live in paired:
                uef_id = live["match_id"]
                score = live["score"]
                team1_score: int = score.get("home", 0)
                team2_score: int = score.get("away", 0)
                yellow_cards = 0
                red_cards = 0

                # Fetch per-team statistics
                try:
                    stat_resp = await client.get(
                        f"{UEFA_STATS_ENDPOINT}{uef_id}", headers=HEADERS
                    )
                    stat_resp.raise_for_status()
                    stat_data: list[dict] = stat_resp.json()

                    for team_stat in stat_data:
                        for stat in team_stat.get("statistics", []):
                            if stat["name"] == "yellow_cards":
                                yellow_cards += int(stat.get("value", 0))
                            elif stat["name"] == "red_cards":
                                red_cards += int(stat.get("value", 0))
                except Exception:
                    logger.warning(
                        "[JOB1] Could not fetch stats for UEFA match %s – using score only",
                        uef_id,
                    )

                await db.execute(
                    update(Match)
                    .where(Match.id == db_match.id)
                    .values(
                        team1_score=team1_score,
                        team2_score=team2_score,
                        yellow_card_count=yellow_cards,
                        red_card_count=red_cards,
                        match_datetime = db_match.match_datetime.replace(tzinfo=timezone.utc) if  db_match.match_datetime.tzinfo is None else db_match.match_datetime.astimezone(timezone.utc)
                    )
                )
                logger.info(
                    "[JOB1] Updated match id=%d  %d–%d  Y=%d R=%d",
                    db_match.id,
                    team1_score,
                    team2_score,
                    yellow_cards,
                    red_cards,
                )

        await db.commit()

    logger.info("[JOB1] extract_live_match_data – done")



async def extract_live_match_data_fifa() -> None:
    """
    Poll the FIFA livescore API every settings.LIVE_MATH_UPDATE_INTERVAL_MIN minutes.

    For each locked match currently in-play (started within the last 140 minutes):
      • fetch live score from the livescore endpoint
      • fetch per-team card stats from the team-statistics endpoint
      • update team1_score, team2_score, yellow_card_count, red_card_count in DB
    """
    logger.info("[JOB1] extract_live_match_data – starting")

    window_start = _now_utc() - timedelta(minutes=160) # 160 minutes is tentative possible max match time
    window_end = _now_utc()

    async with async_session_factory() as db:
        # Fetch locked matches that could be live right now
        result = await db.execute(
            select(Match)
            .options(selectinload(Match.team1), selectinload(Match.team2))
            .where(Match.match_locked.is_(True))
            .where(Match.match_datetime <= window_end)
            .where(Match.match_datetime >= window_start)
            .order_by(Match.match_datetime.asc(), Match.id.asc()),
        )
        active_matches: list[Match] = list(result.scalars().all())

        if not active_matches:
            logger.info("[JOB1] No active matches in the live window – nothing to do")
            return

        logger.info("[JOB1] %d active match(es) found", len(active_matches))

        async with httpx.AsyncClient(timeout=15) as client:
            try:
                match_details_resp = await client.get(MATCH_DETAILS_ENDPOINT, headers=HEADERS)
                match_details_resp.raise_for_status()
            except Exception:
                logger.warning("Failed to fetch details data")

            match_details_json = {}
            if match_details_resp.status_code == status.HTTP_200_OK:
                match_details_json = match_details_resp.json()

            # schema based on response of MATCH_DETAILS_ENDPOINT
            match_details_list = [result for result in match_details_json["Results"] if result.get("CompetitionName", [{}])[0].get("Description") == COMPETITIONS_NAME and result.get("SeasonName", [{}])[0].get("Description") == SEASON_NAME]


            id_match = None
            for match in active_matches:
                # dont update if winner is already decided
                if match.winner_id is not None:
                    continue
                for match_detail in match_details_list:
                    home_country_code = match_detail.get('Home', {}).get('IdCountry', None).upper()
                    away_country_code = match_detail.get('Away', {}).get('IdCountry', None).upper()
                    if (home_country_code == match.team1.fifa_code.upper() and away_country_code == match.team2.fifa_code.upper()) or (
                        home_country_code == match.team2.fifa_code.upper() and away_country_code == match.team1.fifa_code.upper()
                    ):
                        id_match = match_detail.get("IdMatch")
                        break
                
                if id_match is None:
                    continue

                async with httpx.AsyncClient(timeout=15) as client:
                    # ── Fetch live scores ───────────────────────────────────────────────
                    try:
                        resp = await client.get(f"{FIFA_LIVE_MATCH_ENDPOINT}/{id_match}?language=en", headers=HEADERS)
                        resp.raise_for_status()
                    except Exception:
                        logger.exception("[JOB1] Failed to fetch livescore data")
                        continue

                def minute_key(goal):
                    minute = goal["Minute"].replace("'", "")
                    parts = minute.split("+")
                    base = int(parts[0])
                    extra = int(parts[1]) if len(parts) > 1 else 0
                    return (base, extra)

                live_entries: list[dict] = []
                result = resp.json()

                # completed match
                if result.get('OfficialityStatus') == 1 and match.winner_id is not None:
                    continue

                home_country_code = result.get('HomeTeam').get('IdCountry').upper()
                away_country_code = result.get('AwayTeam').get('IdCountry').upper()
                correct_match = (match.team1.fifa_code.upper() == home_country_code or match.team1.fifa_code.upper() == away_country_code) or (match.team1.fifa_code.upper() == away_country_code and match.team2.fifa_code.upper() == home_country_code)


                if correct_match:
                    team1_score = 0
                    team2_score = 0
                    first_goal_in = None
                    first_score_by = None
                    match_duration = match.match_duration

                    if home_country_code == match.team1.fifa_code:
                        team1_score = result.get('HomeTeam').get('Score')
                        team2_score = result.get('AwayTeam').get('Score')
                    else:
                        team1_score = result.get('AwayTeam').get('Score')
                        team2_score = result.get('HomeTeam').get('Score')

                    goals = []
                    goals.extend(result.get('HomeTeam').get('Goals') if result.get('HomeTeam').get('Score') > 0 else [])
                    goals.extend(result.get('AwayTeam').get('Goals') if result.get('AwayTeam').get('Score') > 0 else [])

                    first_goal = min(goals, key=minute_key) if goals else None

                    first_goal_min = int(first_goal.get('Minute').split("'")[0]) if first_goal else None
                    
                    if first_goal_min is not None:
                        if first_goal_min <= 45:
                            first_goal_in = '1H'
                        elif first_goal_min > 45 and first_goal_min <= 90:
                            first_goal_in = '2H'
                        elif first_goal_min > 90 and first_goal_min <= 120:
                            first_goal_in = 'ET'

                    if first_goal is not None:
                        if first_goal.get('IdTeam') == result.get('HomeTeam').get('IdTeam'):
                            first_score_by = match.team1_id
                        elif first_goal.get('IdTeam') == result.get('AwayTeam').get('IdTeam'):
                            first_score_by = match.team2_id

                    bookings = []
                    bookings.extend(result.get('HomeTeam').get('Bookings'))
                    bookings.extend(result.get('AwayTeam').get('Bookings'))

                    yellow_card_count = len([booking for booking in bookings if booking.get('Card') == 1])
                    red_card_count = len([booking for booking in bookings if booking.get('Card') == 2])

                    if match.match_stage != MatchStage.GROUP:
                        match_time = result.get('MatchTime').split("'")[0]
                        match_duration = MatchDuration.REGULAR if int(match_time) <= 90 else MatchDuration.EXTRA_TIME if int(match_time) <= 120 else MatchDuration.PENALTY
                    live_entries.append(
                        {
                            "id": match.id,
                            "team1_score": team1_score,
                            "team2_score": team2_score,
                            "first_goal_in": first_goal_in,
                            "first_scoring_team_id": first_score_by,
                            "yellow_card_count": yellow_card_count,
                            "red_card_count": red_card_count,
                            "match_duration": match_duration,
                            "match_status": "COMPLETED" if result.get('OfficialityStatus') == 1 else "LIVE" if result.get('OfficialityStatus') == 0 else "SCHEDULED"
                        }
                    )

                if len(live_entries) == 0:
                    logger.info("[JOB1] Livescore API returned no LIVE/FINISHED matches")
                    return

                # if len(live_entries) >= 2:
                #     live_only = [e for e in live_entries if e["match_status"] == "LIVE"]
                #     if live_only:
                #         live_entries = live_only

                # ── Match live entries to DB rows by position ─────────────────
                paired = list(zip(active_matches, live_entries))

                for db_match, live in paired:
                    team1_score: int = live.get("team1_score", 0)
                    team2_score: int = live.get("team2_score", 0)
                    yellow_card_count = live.get("yellow_card_count", 0)
                    red_card_count = live.get("red_card_count", 0)
                    first_goal_in = live.get("first_goal_in", None)
                    first_scoring_team_id = live.get("first_scoring_team_id", None)
                    kick_off_team_id = live.get("kick_off_team_id", db_match.kick_off_team_id)
                    match_duration = live.get("match_duration", db_match.match_duration)
                    winner_id = db_match.team1_id if live.get("match_status") == "COMPLETED" and team1_score > team2_score else db_match.team2_id if live.get("match_status") == "COMPLETED" and team2_score > team1_score else None

                    if db_match.match_datetime.tzinfo is None:
                        match_datetime = db_match.match_datetime.replace(tzinfo=timezone.utc)
                    else:
                        match_datetime = db_match.match_datetime.astimezone(timezone.utc)

                    await db.execute(
                        update(Match)
                        .where(Match.id == db_match.id)
                        .values(
                            team1_score=team1_score,
                            team2_score=team2_score,
                            first_goal_in=first_goal_in,
                            first_scoring_team_id=first_scoring_team_id,
                            yellow_card_count=yellow_card_count,
                            red_card_count=red_card_count,
                            kick_off_team_id=kick_off_team_id,
                            match_duration=match_duration,
                            winner_id=winner_id,
                            match_datetime=match_datetime
                        )
                    )
                    logger.info(
                        "[JOB1] Updated match id=%d  %d–%d  Y=%d R=%d  FGI:%s  FST:%s  KOT:%s  MD:%s  WD:%s",
                        db_match.id,
                        team1_score,
                        team2_score,
                        yellow_card_count,
                        red_card_count,
                        first_goal_in,
                        first_scoring_team_id,
                        kick_off_team_id,
                        match_duration,
                    )

                await db.commit()

    logger.info("[JOB1] extract_live_match_data – done")


# ═════════════════════════════════════════════════════════════════════════════
# JOB 2 – Update current match day
# ═════════════════════════════════════════════════════════════════════════════


async def update_current_match_day() -> None:
    """
    Keep the ``current_match_day`` setting in sync with upcoming fixtures.

    Finds the next match that starts within the next 24 hours and sets
    ``current_match_day`` to that match's match_day value.
    """
    logger.info("[JOB2] update_current_match_day – starting")

    now = _now_utc()
    tomorrow = now + timedelta(days=1)

    async with async_session_factory() as db:
        result = await db.execute(
            select(Match)
            .where(Match.match_datetime >= now)
            .where(Match.match_datetime <= tomorrow)
            .order_by(Match.match_datetime.asc())
            .limit(1),
        )
        upcoming: Match | None = result.scalar_one_or_none()

        if upcoming is None:
            logger.info("[JOB2] No upcoming match within the next 24 hours – skipping")
            return

        new_day = str(upcoming.match_day)
        json_value = {"day": new_day}

        # Upsert the setting row
        setting_result = await db.execute(
            select(Setting).where(Setting.name == "current_match_day"),
        )
        setting: Setting | None = setting_result.scalar_one_or_none()

        if setting is None:
            db.add(
                Setting(
                    name="current_match_day",
                    friendly_name="Current Match Day",
                    value=json_value,
                )
            )
            logger.info("[JOB2] Created current_match_day = %s", json_value)
        elif setting.value != json_value:
            setting.value = json_value
            logger.info("[JOB2] Updated current_match_day = %s", json_value)
        else:
            logger.info("[JOB2] current_match_day already = %s – no change", json_value)

        await db.commit()
        await _send_final_winners_match_day_email_if_needed(
            db,
            match_day=upcoming.match_day,
            now=now,
        )

    logger.info("[JOB2] update_current_match_day – done")


# ═════════════════════════════════════════════════════════════════════════════
# JOB 3 – Auto-lock matches & send locked predictions email
# ═════════════════════════════════════════════════════════════════════════════


async def send_autolock_email() -> None:
    """
    Lock any unlocked match whose kick-off is ≤60 minutes away, then
    email every user a table of predictions for those newly-locked matches.
    """
    logger.info("[JOB3] send_autolock_email – starting")

    now = _now_utc()
    lock_before = now + timedelta(minutes=60)

    async with async_session_factory() as db:
        # Find matches to lock
        result = await db.execute(
            select(Match)
            .options(
                selectinload(Match.team1),
                selectinload(Match.team2),
            )
            .where(Match.match_locked.is_(False))
            .where(Match.match_datetime <= lock_before),
        )
        to_lock: list[Match] = list(result.scalars().all())

        if not to_lock:
            logger.info("[JOB3] No matches to lock – nothing to do")
            return

        # Lock all of them one at a time (just to ensure correct timezone info)
        for m in to_lock:
            m.match_datetime = m.match_datetime.replace(tzinfo=timezone.utc) if  m.match_datetime.tzinfo is None else m.match_datetime.astimezone(timezone.utc)
            await db.execute(
                update(Match)
                .where(Match.id == m.id)
                .values(match_locked=True, match_datetime = m.match_datetime),
            )

        await db.commit()
        logger.info("[JOB3] Locked %d match(es): %s", len(to_lock), to_lock)

        # Fetch all user emails
        user_result = await db.execute(
            select(User.email).where(User.is_active.is_(True)),
        )
        recipients: list[str] = list(user_result.scalars().all())

        if not recipients:
            logger.info("[JOB3] No active users – skipping email")
            return

        # Build one email per newly-locked match
        for match in to_lock:
            pred_result = await db.execute(
                select(Prediction)
                .options(
                    selectinload(Prediction.user),
                    selectinload(Prediction.kick_off_team),
                    selectinload(Prediction.first_scoring_team),
                )
                .where(Prediction.match_id == match.id)
                .order_by(Prediction.id.asc()),
            )
            predictions: list[Prediction] = list(pred_result.scalars().all())
            predictions.sort(key=lambda prediction: _user_name_sort_key(prediction.user))

            team1_name = match.team1.name
            team2_name = match.team2.name
            match_title = f"{team1_name} vs {team2_name}"

            header_html = (
                f"<tr>"
                f"<th>#</th><th>Player</th>"
                f"<th>{team1_name}</th><th>{team2_name}</th>"
                f"<th>First Goal in</th><th>First Score by</th>"
                f"<th>Yellow Cards</th><th>Red Cards</th>"
                f"<th>Kick-off Team</th><th>Duration</th>"
                f"</tr>"
            )

            rows_html = ""
            for idx, pred in enumerate(predictions, start=1):
                rows_html += (
                    f"<tr>"
                    f"<td>{idx}</td>"
                    f"<td>{pred.user.first_name} {pred.user.last_name}</td>"
                    f"<td>{_fmt_value(pred.team1_score) if pred.team1_score is not None else '-'}</td>"
                    f"<td>{_fmt_value(pred.team2_score) if pred.team2_score is not None else '-'}</td>"
                    f"<td>{_fmt_first_goal_in(pred.first_goal_in) if pred.first_goal_in is not None else '-'}</td>"
                    f"<td>{_fmt_value(pred.first_scoring_team.name) if pred.first_scoring_team is not None else '-'}</td>"
                    f"<td>{_fmt_value(pred.yellow_card_count) if pred.yellow_card_count is not None else '-'}</td>"
                    f"<td>{_fmt_value(pred.red_card_count) if pred.red_card_count is not None else '-'}</td>"
                    f"<td>{_fmt_value(pred.kick_off_team.name) if pred.kick_off_team is not None else '-'}</td>"
                    f"<td>{_fmt_duration(pred.match_duration) if pred.match_duration is not None else '-'}</td>"
                    f"</tr>"
                )

            if not rows_html:
                rows_html = "<tr><td colspan='10'>No predictions submitted.</td></tr>"

            table_html = f"<table><thead>{header_html}</thead><tbody>{rows_html}</tbody></table>"

            body = build_base_html(
                f"<p>Dear all,</p>"
                f"<p>Predictions for <strong>{match_title}</strong> are now locked. Match will starts at {match.match_datetime.replace(tzinfo=UTC).astimezone().strftime('%Y-%m-%d %I:%M %p')}.</p>"
                f"{table_html}"
            )

            await send_email(
                subject=f"World Cup 2026 – {match_title} Locked",
                html_body=body,
                recipients=recipients,
            )

    logger.info("[JOB3] send_autolock_email – done")


# ═════════════════════════════════════════════════════════════════════════════
# JOB 4 – Prediction reminder email
# ═════════════════════════════════════════════════════════════════════════════


async def send_reminder_email() -> None:
    """
    Every 30 minutes: find matches within the next 3 hours that have not had
    a reminder sent yet, then email all users showing who has/hasn't predicted.
    """
    logger.info("[JOB4] send_reminder_email – starting")

    now = _now_utc()
    reminder_window = now + timedelta(hours=3)

    async with async_session_factory() as db:
        result = await db.execute(
            select(Match)
            .options(
                selectinload(Match.team1),
                selectinload(Match.team2),
            )
            .where(Match.match_reminder_sent.is_(False))
            .where(Match.match_locked.is_(False))
            .where(Match.match_datetime >= now)
            .where(Match.match_datetime <= reminder_window)
            .order_by(Match.match_datetime.asc()),
        )
        upcoming: list[Match] = list(result.scalars().all())

        if not upcoming:
            logger.info("[JOB4] No matches needing a reminder – skipping")
            return

        # Fetch all active user
        user_result = await db.execute(
            select(User).where(
                (User.is_active.is_(True)) &
                (User.role != UserRole.ADMIN)
            ).order_by(User.first_name.asc(), User.last_name.asc(), User.id.asc()),
        )
        all_users: list[User] = list(user_result.scalars().all())
        recipients: list[str] = [u.email for u in all_users]

        if not recipients:
            logger.info("[JOB4] No active users – skipping email")
            return

        tables_html = ""

        for match in upcoming:
            team1_name = match.team1.name
            team2_name = match.team2.name
            match_title = f"{team1_name} vs {team2_name}"
            match_time_str = match.match_datetime.replace(tzinfo=UTC).astimezone().strftime("%Y-%m-%d %I:%M %p")

            # Fetch existing predictions for this match
            pred_result = await db.execute(
                select(Prediction)
                .where(Prediction.match_id == match.id)
                .options(selectinload(Prediction.user)),
            )
            existing_preds: list[Prediction] = list(pred_result.scalars().all())
            predicted_user_ids = {p.user_id for p in existing_preds}

            header_html = (
                f"<thead>"
                f"<tr><th colspan='3'>{match_title}</th></tr>"
                f"<tr><th colspan='3'>{match_time_str}</th></tr>"
                f"<tr><th>#</th><th>Player</th><th>Predicted?</th></tr>"
                f"</thead>"
            )

            rows_html = ""
            for idx, user in enumerate(all_users, start=1):
                predicted = user.id in predicted_user_ids
                status_class = "" if predicted else "not-predicted"
                status_text = "✓ Yes" if predicted else "✗ No"
                rows_html += (
                    f"<tr>"
                    f"<td>{idx}</td>"
                    f"<td>{user.first_name} {user.last_name}</td>"
                    f"<td class='{status_class}'>{status_text}</td>"
                    f"</tr>"
                )

            tables_html += (
                f"<table>{header_html}<tbody>{rows_html}</tbody></table><br>"
            )

            # Mark reminder sent
            match.match_reminder_sent = True

            if match.match_datetime.tzinfo is None:
                match.match_datetime = match.match_datetime.replace(tzinfo=timezone.utc)
            else:
                match.match_datetime = match.match_datetime.astimezone(timezone.utc)

        await db.commit()

        body = build_base_html(
            f"<p>Dear all,</p>"
            f"<p>A match is starting soon! Please submit your predictions before kick-off.</p>"
            f"{tables_html}"
        )

        await send_email(
            subject=f"World Cup 2026 – Prediction Reminder ({now.strftime('%Y-%m-%d')})",
            html_body=body,
            recipients=recipients,
        )

    logger.info("[JOB4] send_reminder_email – done")


# ═════════════════════════════════════════════════════════════════════════════
# JOB 5 – Today's matches morning digest
# ═════════════════════════════════════════════════════════════════════════════


async def send_todays_matches_email() -> None:
    """
    Sent once per day at 10:00 server time.

    Emails all active users a table listing every match scheduled within
    the next 24 hours so they remember to submit predictions.
    """
    logger.info("[JOB5] send_todays_matches_email – starting")

    now = _now_utc()
    tomorrow = now + timedelta(days=1)

    async with async_session_factory() as db:
        result = await db.execute(
            select(Match)
            .options(
                selectinload(Match.team1),
                selectinload(Match.team2),
            )
            .where(Match.match_datetime >= now)
            .where(Match.match_datetime <= tomorrow)
            .order_by(Match.match_datetime.asc()),
        )
        matches: list[Match] = list(result.scalars().all())

        # Fetch all active user's email
        user_result = await db.execute(
            select(User.email).where(
                (User.is_active.is_(True)) &
                (User.role != UserRole.ADMIN)
            ).order_by(User.id.asc()),
        )
        recipients: list[str] = list(user_result.scalars().all())

    if not recipients:
        logger.info("[JOB5] No active users – skipping email")
        return

    header_html = "<tr><th>Match Day</th><th>Match</th><th>Match Time</th></tr>"

    if matches:
        rows_html = "".join(
            f"<tr>"
            f"<td>Day {m.match_day}</td>"
            f"<td>{m.team1.name} vs {m.team2.name}</td>"
            f"<td>{m.match_datetime.replace(tzinfo=UTC).astimezone().strftime('%Y-%m-%d %I:%M %p')}</td>"
            f"</tr>"
            for m in matches
        )
    else:
        rows_html = "<tr><td colspan='3'>No matches scheduled in the next 24 hours.</td></tr>"

    table_html = f"<table><thead>{header_html}</thead><tbody>{rows_html}</tbody></table>"

    body = build_base_html(
        f"<p>Dear all,</p>"
        f"<p>Here is the match schedule for the next 24 hours "
        f"(as of {now.replace(tzinfo=UTC).astimezone().strftime('%Y-%m-%d %I:%M %p')}):</p>"
        f"{table_html}"
        f"<p>Don't forget to submit your predictions before kick-off!</p>"
    )

    await send_email(
        subject=f"World Cup 2026 – Today's Matches ({now.strftime('%Y-%m-%d')})",
        html_body=body,
        recipients=recipients,
    )

    logger.info("[JOB5] send_todays_matches_email – done")


async def update_fifa_ranking():
    """
    Fetches the latest FIFA rankings and updates all teams.
    """
    logger.info("[JOB6] update_fifa_ranking – starting")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(RANKING_ENDPOINT, headers=HEADERS)
            resp.raise_for_status()

        results = resp.json().get("Results", [])

        if not results:
            logger.info("[JOB6] No ranking entries found – skipping")
            return

        ranking_map = {
            item["IdCountry"]: item["Rank"]
            for item in results
        }

        logger.info(
            "[JOB6] Retrieved rankings for %d countries",
            len(ranking_map),
        )

    except Exception:
        logger.exception("[JOB6] Failed to fetch FIFA ranking data")
        return

    async with async_session_factory() as db:
        try:
            result = await db.execute(
                select(Team)
            )
            teams: list[Team] = list(result.scalars().all())

            if not teams:
                logger.info("[JOB6] No teams found – skipping")
                return

            updated_count = 0

            for team in teams:
                fifa_rank = ranking_map.get(team.fifa_code)

                if fifa_rank is None:
                    logger.debug(
                        "[JOB6] No ranking found for team %s",
                        team.fifa_code,
                    )
                    continue

                if team.fifa_rank != fifa_rank:
                    team.fifa_rank = fifa_rank
                    updated_count += 1

            await db.commit()

            logger.info(
                "[JOB6] Updated rankings for %d teams",
                updated_count,
            )

        except Exception:
            await db.rollback()
            logger.exception("[JOB6] Failed to update FIFA rankings")
            raise


# ═════════════════════════════════════════════════════════════════════════════
# Scheduler bootstrap
# ═════════════════════════════════════════════════════════════════════════════


def _create_scheduler() -> AsyncIOScheduler:
    """Instantiate and configure the APScheduler instance."""
    scheduler = AsyncIOScheduler(timezone=settings.TIMEZONE)

    # Job 1 – Live data extraction: every settings.LIVE_MATH_UPDATE_INTERVAL_MIN minutes
    scheduler.add_job(
        extract_live_match_data_fifa,
        trigger=IntervalTrigger(minutes=settings.LIVE_MATH_UPDATE_INTERVAL_MIN),
        id="extract_live_match_data",
        name="Live match data extraction",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=30,
    )

    # Job 2 – Auto-lock & locked email: every settings.MATCH_LOCK_CHECK_INTERVAL_MIN minutes
    scheduler.add_job(
        send_autolock_email,
        trigger=IntervalTrigger(minutes=settings.MATCH_LOCK_CHECK_INTERVAL_MIN),
        id="send_autolock_email",
        name="Auto-lock matches and send prediction summary email",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=60,
    )

    # Job 3 – Prediction reminder: every settings.REMINDER_CHECK_INTERVAL_MIN minutes
    scheduler.add_job(
        send_reminder_email,
        trigger=IntervalTrigger(minutes=settings.REMINDER_CHECK_INTERVAL_MIN),
        id="send_reminder_email",
        name="Send prediction reminder email",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=120,
    )

    # Job 4 – Update current match day: on settings.MATCH_DAY_UPDATE_TIME_HR hours 1 minutes
    scheduler.add_job(
        update_current_match_day,
        trigger=CronTrigger(hour=settings.MATCH_DAY_UPDATE_TIME_HR, minute=1),
        id="update_current_match_day",
        name="Update current match day",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=600,
    )

    # Job 5 – Today's matches digest: daily at settings.TODAYS_MATCH_REMINDER_TIME_HR:00 Local time
    scheduler.add_job(
        send_todays_matches_email,
        trigger=CronTrigger(hour=settings.TODAYS_MATCH_REMINDER_TIME_HR, minute=0),
        id="send_todays_matches_email",
        name="Send today's matches morning digest",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=600,
    )

    # Job 6 – Fifa ranking update: daily at 00:00 Local time
    scheduler.add_job(
        update_fifa_ranking,
        trigger=CronTrigger(hour=0, minute=0),
        id="update_fifa_ranking",
        name="Update FIFA ranking",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=600,
    )

    return scheduler


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:  # noqa: ARG001
    """
    FastAPI lifespan context manager.

    Starts the APScheduler on app startup and shuts it down cleanly on exit.

    Register in main.py:

        from app.workers.scheduler import lifespan
        app = FastAPI(..., lifespan=lifespan)
    """
    scheduler = _create_scheduler()
    scheduler.start()
    logger.info(
        "Scheduler started with %d job(s): %s",
        len(scheduler.get_jobs()),
        [j.id for j in scheduler.get_jobs()],
    )

    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")
