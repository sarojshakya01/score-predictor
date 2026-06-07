from openai import OpenAI

import logging
import json
from app.core.config import settings

class OpenAIService:
    def __init__(self) -> None:
        self.endpoint = settings.OPENAI_ENDPOINT
        self.deployment_name = settings.OPENAI_DEPLOYMENT_NAME
        self.api_key = settings.OPENAI_KEY

        self.client = OpenAI(
            base_url=self.endpoint,
            api_key=self.api_key
        )

    def _get_prediction_from_ai(
        self, 
        content: str,
    ) -> dict:
        try:
            response = self.client.responses.create(
                model=self.deployment_name,
                input=content,
                tools=[
                    {
                        "type": "web_search"
                    }
                ],
                timeout=5.0,
                text={
                    "format": {
                        "type": "json_schema",
                        "name": "team_insights",
                        "schema": {
                            "type": "object",
                            "properties": {
                                "team1": {
                                    "type": "string"
                                },
                                "team2": {
                                    "type": "string"
                                },
                                "summary": {
                                    "type": "string"
                                },
                                "head_to_head": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {"type": "string"},
                                            "team1_score": {"type": "string"},
                                            "team2_score": {"type": "string"},
                                            "result": {"type": "string"}
                                        },
                                        "required": ["date", "team1_score", "team2_score", "result"],
                                        "additionalProperties": False
                                    }
                                },
                                "team1_match_history": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {"type": "string"},
                                            "opponent": {"type": "string"},
                                            "score": {"type": "string"},
                                            "result": {"type": "string"}
                                        },
                                        "required": ["date", "opponent", "score", "result"],
                                        "additionalProperties": False
                                    }
                                },
                                "team2_match_history": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "date": {"type": "string"},
                                            "opponent": {"type": "string"},
                                            "score": {"type": "string"},
                                            "result": {"type": "string"}
                                        },
                                        "required": ["date", "opponent", "score", "result"],
                                        "additionalProperties": False
                                    }
                                }
                            },
                            "required": [
                                "team1",
                                "team2",
                                "summary",
                                "head_to_head",
                                "team1_match_history",
                                "team2_match_history"
                            ],
                            "additionalProperties": False
                        }
                    }
                }
            )
            return json.loads(response.output_text)
        except Exception as e:
            logging.exception("Error during OpenAI prediction", e)
            return {}


    def get_insights_from_ai(
        self, 
        team1: str,
        team2: str
    ) -> str:
        content = f"You are an expert football analyst. You have to give me last 7 match result of each team and available head to head results of {team1} and {team2} in proper JSON format: {{'team1': '', 'team2': '', 'summary': '', 'head_to_head': [], 'team1_match_history': [], 'team2_match_history': []}}"
        insights = self._get_prediction_from_ai(content)

        return insights