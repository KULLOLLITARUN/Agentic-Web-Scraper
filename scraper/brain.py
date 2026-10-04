"""
brain.py
~~~~~~~~
AI extraction engine — turns distilled website text into structured JSON.
Equipped with multi-model auto-failover to handle Groq rate limits.
"""

import asyncio
import os
import logging

import groq
from groq import AsyncGroq

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

GPT_OSS_TOKEN_BUDGET = 6000

# Error codes meaning "this particular model can't be used" — worth failing over.
MODEL_ERROR_CODES = {"model_not_found", "model_decommissioned", "model_not_active"}


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
        self._client = AsyncGroq(api_key=api_key)
        # A preferred model is tried first; the rest of the pool stays as failover.
        self._models = [model] + [m for m in MODELS if m != model] if model else list(MODELS)
        #: True when the last reply stopped at the output token limit
        #: (``finish_reason == "length"``), so its JSON was cut off.
        self.truncated = False

    async def extract(
        self,
        cleaned_text: str,
        schema_description: str,
        previous_error: str | None = None,
    ) -> str:
        """Call the LLM to extract structured data from *cleaned_text*.

        Fails over to the next model on rate limits, oversized requests,
        server/network errors or an unavailable model. Errors that would hit
        every model (invalid API key, malformed request) are raised at once.
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
            "Give every item every field, using null when the page has no value, "
            "and use JSON numbers/booleans (not strings) for numeric/boolean fields. "
            "Return compact JSON on a single line with no indentation, "
            "and make sure every open object and array is closed."
        )
        user_prompt = "\n".join(user_parts)

        last_error = None
        self.truncated = False

        # Iterate through model pool with automatic failover
        for model_name in self._models:
            token_budget = _token_budget(model_name)

            try:
                logger.info("Attempting extraction with model %s (budget=%d tokens)...", model_name, token_budget)
                response = await self._client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.3,
                    max_tokens=token_budget,
                    **_model_options(model_name),
                )
                choice = response.choices[0]
                content = (choice.message.content or "").strip()
                usage = getattr(response, "usage", None)
                if usage is not None:
                    logger.info(
                        "%s used %s prompt + %s completion tokens (finish_reason=%s)",
                        model_name,
                        usage.prompt_tokens,
                        usage.completion_tokens,
                        getattr(choice, "finish_reason", None),
                    )
                if content:
                    self.truncated = getattr(choice, "finish_reason", None) == "length"
                    return content
                logger.warning("Empty response from %s. Failing over to next model...", model_name)

            except groq.APIError as e:
                if not _should_failover(e):
                    # The same error would hit every model (bad key, bad request),
                    # so surface it instead of hiding it behind a failover.
                    raise
                last_error = e
                logger.warning("%s failed (%s). Failing over to next model...", model_name, e)
                if isinstance(e, groq.RateLimitError):
                    await asyncio.sleep(1)

        raise last_error or RuntimeError("All models in the extraction pool exhausted.")


def _token_budget(model_name: str) -> int:
    """Output token cap (``max_tokens``) for *model_name*.

    Groq doesn't reserve ``max_tokens`` against the per-minute token limit
    (8,000 for every model in the pool); only tokens actually generated
    count. So a high cap costs nothing on short pages and keeps long ones
    (Quotes pages with long quotes) from being cut off at the last items.
    """
    return 800 if "qwen" in model_name else GPT_OSS_TOKEN_BUDGET


def _model_options(model_name: str) -> dict:
    """Extra request options for models that need them.

    gpt-oss reasons before answering, and those hidden tokens count against
    ``max_tokens``. Extraction needs little reasoning: on a 30-story Hacker
    News page the default effort spent 1,822 of 3,327 output tokens
    reasoning (close to cutting off the JSON); "low" spent 50 with the same
    result.
    """
    if model_name.startswith("openai/gpt-oss"):
        return {"reasoning_effort": "low"}
    return {}


def _error_code(error: groq.APIError) -> str:
    """Return the API error code (e.g. ``model_not_found``) if the body has one."""
    body = error.body if isinstance(error.body, dict) else {}
    inner = body.get("error") if isinstance(body.get("error"), dict) else body
    return str(inner.get("code") or "")


def _should_failover(error: groq.APIError) -> bool:
    """Decide whether another model might succeed where this one failed.

    Rate limits, oversized requests, server errors and network problems are
    specific to one model or moment, so the next model is worth trying. A bad
    API key or a malformed request fails the same way on every model, except
    when the problem is this model itself (missing or decommissioned).
    """
    if isinstance(error, (groq.AuthenticationError, groq.PermissionDeniedError)):
        return False
    if isinstance(error, (groq.BadRequestError, groq.NotFoundError, groq.UnprocessableEntityError)):
        return _error_code(error) in MODEL_ERROR_CODES
    return True
