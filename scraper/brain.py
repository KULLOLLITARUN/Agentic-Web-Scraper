"""
brain.py
~~~~~~~~
AI extraction engine — turns distilled website text into structured JSON.
Equipped with multi-model auto-failover to handle Groq rate limits.
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
    "No markdown fences, no explanation, no thinking blocks, just raw JSON."
)

# Multi-model pool with auto-failover.
# openai/gpt-oss-120b has much higher token throughput than qwen's 1000 OTPM ceiling.
MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b"
]


class Brain:
    """Wraps the Groq API client to extract structured JSON from distilled text.

    Features automatic multi-model failover to prevent 429 Rate Limit errors.
    """

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        api_key = api_key or os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError(
                "GROQ_API_KEY environment variable is not set. "
                "Please export your Groq API key before running the scraper."
            )
        self._client = Groq(api_key=api_key)
        # A preferred model is tried first; the rest of the pool stays as failover.
        self._models = [model] + [m for m in MODELS if m != model] if model else list(MODELS)

    def extract(
        self,
        cleaned_text: str,
        schema_description: str,
        previous_error: str | None = None,
    ) -> str:
        """Call the LLM to extract structured data from *cleaned_text*.

        Automatically fails over across models if a 429 rate limit or token
        exhaustion error occurs.
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

        user_parts.append(
            "\nExtract EVERY matching item on the page, in page order. "
            "Return compact JSON on a single line with no indentation, "
            "and make sure every open object and array is closed."
        )
        user_prompt = "\n".join(user_parts)

        last_error = None

        # Iterate through model pool with automatic failover
        for model_name in self._models:
            # Scale tokens conservatively for qwen, higher for gpt-oss
            token_budget = 800 if "qwen" in model_name else 3500

            try:
                logger.info("Attempting extraction with model %s (budget=%d tokens)...", model_name, token_budget)
                response = self._client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.3,
                    max_tokens=token_budget,
                )
                content = response.choices[0].message.content.strip()
                if content:
                    return content

            except Exception as e:
                last_error = e
                err_msg = str(e).lower()
                if "rate_limit" in err_msg or "429" in err_msg or "tokens" in err_msg or "otpm" in err_msg:
                    logger.warning(
                        "Rate limit on %s (error: %s). Auto-failing over to next model in pool...",
                        model_name,
                        e,
                    )
                    time.sleep(1)
                    continue
                else:
                    logger.error("Non-rate-limit error on %s: %s", model_name, e)
                    continue

        raise last_error or RuntimeError("All models in the extraction pool exhausted.")
