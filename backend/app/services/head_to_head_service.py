"""service for football teams head-to-head score snippets."""

import html
import re
from html.parser import HTMLParser
from urllib.parse import urlencode

import httpx

from app.schemas.match import HeadToHeadMatch, HeadToHeadResponse


class _VisibleTextParser(HTMLParser):
    """Extract visible-ish text from simple HTML without external dependencies."""

    def __init__(self) -> None:
        super().__init__()
        self._chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth:
            return

        stripped_data = data.strip()
        if stripped_data:
            self._chunks.append(stripped_data)

    @property
    def text(self) -> str:
        """Return normalized text content."""
        return " ".join(self._chunks)


_DATE_PATTERN = re.compile(
    r"(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)"
    r"[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\b20\d{2}\b)",
    re.IGNORECASE,
)


class HeadToHeadService:
    """search snippets for recent head-to-head scores."""

    GOOGLE_SEARCH_URL = "https://www.google.com/search"

    async def search(
        self,
        *,
        team1_name: str,
        team1_code: str,
        team2_name: str,
        team2_code: str,
        limit: int,
    ) -> HeadToHeadResponse:
        """Fetch Google search results and parse recent H2H score snippets."""
        query = (
            f"{team1_name} vs {team2_name} football head to head "
            "last 7 matches scores"
        )
        html_text = await self._fetch_html(query=query)
        page_text = self._html_to_text(html_text)
        items = self._parse_scores(
            page_text=page_text,
            team1_aliases=self._build_aliases(team1_name, team1_code),
            team2_aliases=self._build_aliases(team2_name, team2_code),
            limit=limit,
        )

        return HeadToHeadResponse(
            items=items,
            limit=limit,
            query=query,
            team1_name=team1_name,
            team2_name=team2_name,
            total=len(items),
        )

    async def _fetch_html(self, *, query: str) -> str:
        search_url = f"{self.GOOGLE_SEARCH_URL}?{urlencode({'q': query, 'hl': 'en', 'gl': 'us', 'num': '10'})}"
        headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
        }

        async with httpx.AsyncClient(
            follow_redirects=True,
            headers=headers,
            timeout=8.0,
        ) as client:
            response = await client.get(search_url)
            response.raise_for_status()
            return response.text

    @staticmethod
    def _html_to_text(html_text: str) -> str:
        parser = _VisibleTextParser()
        parser.feed(html.unescape(html_text))
        return re.sub(r"\s+", " ", parser.text).strip()

    @staticmethod
    def _build_aliases(team_name: str, team_code: str) -> list[str]:
        aliases = {
            team_name.strip(),
            team_name.replace("-H", "").replace("-A", "").strip(),
            team_code.strip(),
        }

        return sorted((alias for alias in aliases if alias), key=len, reverse=True)

    @staticmethod
    def _alias_pattern(aliases: list[str]) -> str:
        escaped_aliases = []
        for alias in aliases:
            escaped_alias = re.escape(alias)
            escaped_alias = escaped_alias.replace(r"\ ", r"\s+")
            escaped_aliases.append(escaped_alias)

        return r"(?:" + "|".join(escaped_aliases) + r")"

    def _parse_scores(
        self,
        *,
        page_text: str,
        team1_aliases: list[str],
        team2_aliases: list[str],
        limit: int,
    ) -> list[HeadToHeadMatch]:
        team1_pattern = self._alias_pattern(team1_aliases)
        team2_pattern = self._alias_pattern(team2_aliases)
        separator_pattern = r"\s*(?:-|–|—|:)\s*"
        patterns = [
            re.compile(
                rf"(?P<left>{team1_pattern}|{team2_pattern})\s+"
                rf"(?P<left_score>\d{{1,2}}){separator_pattern}"
                rf"(?P<right_score>\d{{1,2}})\s+"
                rf"(?P<right>{team1_pattern}|{team2_pattern})",
                re.IGNORECASE,
            ),
            re.compile(
                rf"(?P<left>{team1_pattern}|{team2_pattern})"
                rf".{{0,45}}?(?:vs\.?|v\.?|versus)"
                rf".{{0,45}}?(?P<right>{team1_pattern}|{team2_pattern})"
                rf".{{0,80}}?(?P<left_score>\d{{1,2}}){separator_pattern}"
                rf"(?P<right_score>\d{{1,2}})",
                re.IGNORECASE,
            ),
        ]
        items: list[HeadToHeadMatch] = []
        seen_snippets: set[str] = set()

        for pattern in patterns:
            for match in pattern.finditer(page_text):
                left = match.group("left")
                right = match.group("right")
                if self._same_team(left, right, team1_aliases, team2_aliases):
                    continue

                start = max(0, match.start() - 90)
                end = min(len(page_text), match.end() + 120)
                snippet = page_text[start:end].strip()
                normalized_snippet = re.sub(r"\s+", " ", snippet).lower()
                if normalized_snippet in seen_snippets:
                    continue

                team1_score, team2_score = self._orient_scores(
                    left=left,
                    left_score=int(match.group("left_score")),
                    right_score=int(match.group("right_score")),
                    team1_aliases=team1_aliases,
                )
                items.append(
                    HeadToHeadMatch(
                        date_text=self._extract_date(snippet),
                        raw_text=snippet,
                        team1_score=team1_score,
                        team2_score=team2_score,
                    ),
                )
                seen_snippets.add(normalized_snippet)

                if len(items) >= limit:
                    return items

        return items

    @staticmethod
    def _same_team(
        left: str,
        right: str,
        team1_aliases: list[str],
        team2_aliases: list[str],
    ) -> bool:
        left_is_team1 = HeadToHeadService._matches_alias(left, team1_aliases)
        right_is_team1 = HeadToHeadService._matches_alias(right, team1_aliases)
        left_is_team2 = HeadToHeadService._matches_alias(left, team2_aliases)
        right_is_team2 = HeadToHeadService._matches_alias(right, team2_aliases)
        return (left_is_team1 and right_is_team1) or (left_is_team2 and right_is_team2)

    @staticmethod
    def _matches_alias(value: str, aliases: list[str]) -> bool:
        normalized_value = value.strip().casefold()
        return any(normalized_value == alias.strip().casefold() for alias in aliases)

    @staticmethod
    def _orient_scores(
        *,
        left: str,
        left_score: int,
        right_score: int,
        team1_aliases: list[str],
    ) -> tuple[int, int]:
        if HeadToHeadService._matches_alias(left, team1_aliases):
            return left_score, right_score

        return right_score, left_score

    @staticmethod
    def _extract_date(snippet: str) -> str | None:
        match = _DATE_PATTERN.search(snippet)
        return match.group(0) if match else None
