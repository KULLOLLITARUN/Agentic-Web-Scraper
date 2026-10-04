"""
brain.py
~~~~~~~~
AI extraction engine — turns distilled website text into structured JSON.
Equipped with multi-model auto-failover to handle Groq rate limits.
"""

import asyncio
import os
import re
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

# Output token caps. Groq's free tier allows 8,000 tokens per minute per
# model, and it sometimes rejects a request (413) when prompt + max_tokens
# goes over that, so the cap shrinks as the prompt grows.
TPM_LIMIT = 8000
GPT_OSS_TOKEN_BUDGET = 6000
MIN_TOKEN_BUDGET = 1000
# Measured ~3.7 characters per token on a distilled job board page; 3.2
# overestimates the prompt so the total stays under the limit.
CHARS_PER_TOKEN = 3.2
# Wait before retrying a request rejected as too large for the TPM limit.
TOO_LARGE_RETRY_DELAY = 3
# A per-minute rate limit that clears within this many seconds is waited out
# on the same model; longer waits (the daily limit) fail over instead.
MAX_RATE_WAIT = 20

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
        #: The model that gave the last reply; not the first in the pool
        #: means the preferred model failed and a fallback answered.
        self.model_used: str | None = None

    async def extract(
        self,
        cleaned_text: str,
        schema_description: str,
        previous_error: str | None = None,
        part: tuple[int, int] | None = None,
    ) -> str:
        """Call the LLM to extract structured data from *cleaned_text*.

        Fails over to the next model on rate limits, oversized requests,
        server/network errors or an unavailable model. Errors that would hit
        every model (invalid API key, malformed request) are raised at once.

        *part* is ``(number, total)`` when *cleaned_text* is one part of a
        long page split by :mod:`scraper.chunking`.
        """
        user_parts: list[str] = [
            "## DATA SCHEMA (what to extract):",
            schema_description,
            "",
            "## WEBSITE TEXT:",
            cleaned_text,
        ]

        if part is not None:
            number, total = part
            user_parts += [
                "",
                f"## NOTE: this is part {number} of {total} of the page text.",
                "It can start or end partway through an item. Skip an item that is cut off "
                "at the very start or end of this part (it appears in full in the next or "
                "previous part). If this part has no matching items, return [].",
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
            "Items that look alike (same title or company) are separate entries: include each one. "
            "Give every item every field, using null when the page has no value, "
            "and use JSON numbers/booleans (not strings) for numeric/boolean fields. "
            "Return compact JSON on a single line with no indentation, "
            "and make sure every open object and array is closed."
        )
        user_prompt = "\n".join(user_parts)

        last_error = None
        self.truncated = False
        self.model_used = None

        # Iterate through model pool with automatic failover
        for model_name in self._models:
            token_budget = _token_budget(model_name, len(SYSTEM_PROMPT) + len(user_prompt))

            for retry_smaller in (True, False):
                try:
                    content = await self._request(model_name, user_prompt, token_budget)
                except groq.APIError as e:
                    if not _should_failover(e):
                        # The same error would hit every model (bad key, bad request),
                        # so surface it instead of hiding it behind a failover.
                        raise
                    if retry_smaller and _too_large_for_tpm(e) and token_budget > MIN_TOKEN_BUDGET:
                        # The prompt took more tokens than estimated (tables and
                        # numbers do). The same model usually takes a smaller cap
                        # a moment later, and it beats the fallback by far.
                        token_budget = max(MIN_TOKEN_BUDGET, int(token_budget * 0.6))
                        logger.warning("%s: request too large for the TPM limit; retrying with budget=%d.", model_name, token_budget)
                        await asyncio.sleep(TOO_LARGE_RETRY_DELAY)
                        continue
                    wait = _retry_after(e) if isinstance(e, groq.RateLimitError) else None
                    if retry_smaller and wait is not None and wait <= MAX_RATE_WAIT:
                        # A second request soon after the first (the rest of a
                        # page, the next part) goes over the minute's tokens;
                        # the main model is worth a few seconds' wait.
                        logger.warning("%s: rate limited; retrying in %.1fs.", model_name, wait)
                        await asyncio.sleep(wait)
                        continue
                    last_error = e
                    logger.warning("%s failed (%s). Failing over to next model...", model_name, e)
                    if isinstance(e, groq.RateLimitError):
                        await asyncio.sleep(1)
                    break
                if content:
                    self.model_used = model_name
                    return content
                logger.warning("Empty response from %s. Failing over to next model...", model_name)
                break

        raise last_error or RuntimeError("All models in the extraction pool exhausted.")

    async def _request(self, model_name: str, user_prompt: str, token_budget: int) -> str:
        """One completion call; returns the reply text and sets :attr:`truncated`."""
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
        self.truncated = bool(content) and getattr(choice, "finish_reason", None) == "length"
        return content

    @property
    def preferred_model(self) -> str:
        """The model tried first; the rest of the pool is failover."""
        return self._models[0]


def _token_budget(model_name: str, prompt_chars: int) -> int:
    """Output token cap (``max_tokens``) for *model_name* and a prompt of *prompt_chars*.

    gpt-oss gets up to 6,000 so long pages aren't cut off, reduced so that
    the estimated prompt plus the cap stays under the 8,000 TPM limit: with
    a 3,939-token prompt, max_tokens=6000 was rejected with a 413 about one
    call in three, while 3,500-3,900 always went through. A 413 fails over
    to gpt-oss-20b, which on a job board page returned 1 of 22 jobs.
    """
    if "qwen" in model_name:
        return 800
    prompt_tokens = int(prompt_chars / CHARS_PER_TOKEN)
    room = TPM_LIMIT - prompt_tokens - 200  # margin for message overhead
    return max(MIN_TOKEN_BUDGET, min(GPT_OSS_TOKEN_BUDGET, room))


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


def _retry_after(error: groq.APIError) -> float | None:
    """Seconds until a rate limit clears: the retry-after header, else "try again in 7.5s"."""
    response = getattr(error, "response", None)
    header = response.headers.get("retry-after") if response is not None else None
    try:
        if header is not None:
            return float(header)
    except ValueError:
        pass
    match = re.search(r"try again in (?:(\d+)m)?([\d.]+)(ms|s)", str(error))
    if not match:
        return None
    minutes, value, unit = match.groups()
    seconds = float(value) / 1000 if unit == "ms" else float(value)
    return seconds + 60 * int(minutes or 0)


def _too_large_for_tpm(error: groq.APIError) -> bool:
    """A 413 "request too large ... tokens per minute": prompt + max_tokens over the limit."""
    return getattr(error, "status_code", None) == 413 and _error_code(error) == "rate_limit_exceeded"


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
