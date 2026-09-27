"""
brain.py
~~~~~~~~
Groq LLM extraction engine — turns distilled text into structured JSON.
"""

import os
import time
import logging
from groq import Groq

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a precise data extraction engine. "
    "Your ONLY job is to extract structured data from website text and return it as valid JSON. "
    "Return ONLY the JSON object or array. "
    "No markdown fences, no explanation, no <think> blocks, just raw JSON."
)

MODEL = "qwen/qwen3.8-27b"


class Brain:
    """Wraps the Groq API client to extract structured JSON from distilled text.

    The ``GROQ_API_KEY`` environment variable must be set before instantiation.

    Raises:
        ValueError: If ``GROQ_API_KEY`` is not present in the environment.
    """

    def __init__(self) -> None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError(
                "GROQ_API_KEY environment variable is not set. "
                "Please export your Groq API key before running the scraper."
            )
        self._client = Groq(api_key=api_key)

    def extract(
        self,
        cleaned_text: str,
        schema_description: str,
        previous_error: str | None = None,
    ) -> str:
        """Call the Groq LLM to extract structured data from *cleaned_text*.

        Builds a structured prompt containing the extraction schema, the
        website text, and (optionally) feedback from a previous failed
        attempt, then returns the raw LLM response string.

        Args:
            cleaned_text: Plain text produced by :class:`~scraper.distiller.Distiller`.
            schema_description: Natural-language description of what fields to
                extract and what format to return them in.
            previous_error: If a prior extraction attempt failed validation,
                pass the error message here so the LLM can self-correct.

        Returns:
            The raw response string from the LLM (expected to be JSON, but
            validation is handled by :class:`~scraper.validator.Validator`).
        """
        user_parts: list[str] = [
            "## DATA SCHEMA (what to extract):",
            schema_description,
            "",
            "## WEBSITE TEXT:",
            cleaned_text,
        ]

        if previous_error is not None:
            user_parts += [
                "",
                "## PREVIOUS ATTEMPT FAILED - FIX THIS ERROR:",
                f"{previous_error}",
                "Extract again and fix the issue.",
            ]

        user_parts.append("\nExtract the data now and return ONLY valid JSON. /no_think")
        user_prompt = "\n".join(user_parts)

        # Free-tier Groq OTPM limit for qwen3.8-27b is 1,000 tokens/min.
        # Try with 800 tokens first, cascading down to 500/350 if rate limits trigger.
        token_limits = [800, 500, 350]
        last_exception = None

        for attempt_idx, token_limit in enumerate(token_limits):
            try:
                response = self._client.chat.completions.create(
                    model=MODEL,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.4,
                    max_tokens=token_limit,
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                last_exception = e
                err_msg = str(e).lower()
                if "rate_limit" in err_msg or "429" in err_msg or "tokens" in err_msg:
                    logger.warning(
                        "Groq rate limit hit with max_tokens=%d. Backing off 2s and retrying with reduced tokens...",
                        token_limit,
                    )
                    time.sleep(2)
                    continue
                raise

        raise last_exception or RuntimeError("Failed to extract data within token limits.")
