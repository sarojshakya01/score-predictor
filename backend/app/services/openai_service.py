"""OpenAI-backed football insight lookup."""

import json
import logging
from typing import Any

from openai import OpenAI

from app.core.config import settings

logger = logging.getLogger(__name__)


class OpenAIService:
    """Fetch H2H and recent-history data from OpenAI web search."""

    def __init__(self) -> None:
        self.endpoint = settings.OPENAI_ENDPOINT
        self.deployment_name = settings.OPENAI_DEPLOYMENT_NAME
        self.api_key = settings.OPENAI_KEY
        self.client: OpenAI | None = None

        if self.api_key and self.deployment_name:
            client_kwargs: dict[str, str] = {"api_key": self.api_key}
            if self.endpoint:
                client_kwargs["base_url"] = self.endpoint
            self.client = OpenAI(**client_kwargs)

    def _get_prediction_from_ai(
        self,
        content: str,
    ) -> dict[str, Any]:
        if self.client is None:
            logger.info("OpenAI is not configured; using local prediction fallback")
            return {}

        try:
            response = self.client.responses.create(
                model=self.deployment_name,
                input=content,
                tools=[
                    {
                        "type": "web_search",
                    },
                ],
                # timeout=5.0,
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "team_insights",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "team1": {
                                    "type": "string",
                                },
                                "team2": {
                                    "type": "string",
                                },
                                "summary": {
                                    "type": "string",
                                },
                                "head_to_head": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {"type": "string"},
                                            "team1_score": {"type": "integer"},
                                            "team2_score": {"type": "integer"},
                                            "result": {"type": "string"},
                                        },
                                        "required": [
                                            "date",
                                            "team1_score",
                                            "team2_score",
                                            "result",
                                        ],
                                        "additionalProperties": False,
                                    },
                                },
                                "team1_match_history": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {"type": "string"},
                                            "opponent": {"type": "string"},
                                            "score": {"type": "string"},
                                            "result": {"type": "string"},
                                        },
                                        "required": [
                                            "date",
                                            "opponent",
                                            "score",
                                            "result",
                                        ],
                                        "additionalProperties": False,
                                    },
                                },
                                "team2_match_history": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {"type": "string"},
                                            "opponent": {"type": "string"},
                                            "score": {"type": "string"},
                                            "result": {"type": "string"},
                                        },
                                        "required": [
                                            "date",
                                            "opponent",
                                            "score",
                                            "result",
                                        ],
                                        "additionalProperties": False,
                                    },
                                },
                            },
                            "required": [
                                "team1",
                                "team2",
                                "summary",
                                "head_to_head",
                                "team1_match_history",
                                "team2_match_history",
                            ],
                            "additionalProperties": False,
                        },
                    },
                },
            )
            return json.loads(response.output_text)
        except Exception as error:
            logger.exception("Error during OpenAI prediction: %s", error)
            return {}

    def get_insights_from_ai(
        self,
        team1: str,
        team2: str,
    ) -> dict[str, Any]:
        content = (
            f"You are an expert football analyst. Return results history of last 7 matches of the {team1} and {team2}. "
            f"Return available head-to-head results of {team1} and "
            f"{team2} only if available. For each team history "
            "item, use a score string from that team's perspective, like "
            "'2-1', with result as W, D, or L. Return proper JSON with: "
            "{'team1': '', 'team2': '', 'summary': '', 'head_to_head': [], "
            "'team1_match_history': [], 'team2_match_history': []}."
        )

        return self._get_prediction_from_ai(content)
