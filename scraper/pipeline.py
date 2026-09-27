"""
pipeline.py
~~~~~~~~~~~
Main orchestrator: wires Navigator → Distiller → Brain → Validator together
with an agentic self-healing retry loop.
"""

import asyncio
import json
import logging
from typing import Any

from scraper.navigator import Navigator
from scraper.distiller import Distiller
from scraper.brain import Brain
from scraper.validator import Validator, ValidationError

logger = logging.getLogger("ai_scraper")


class ScraperPipeline:
    """End-to-end scraping pipeline with agentic self-healing retries.

    The pipeline coordinates four sub-components:

    * :class:`~scraper.navigator.Navigator` — renders the page in a headless browser.
    * :class:`~scraper.distiller.Distiller` — converts HTML to clean plain text.
    * :class:`~scraper.brain.Brain` — sends text + schema to the Groq LLM.
    * :class:`~scraper.validator.Validator` — validates the JSON and feeds errors
      back into the LLM for automatic correction.

    Args:
        max_retries: Maximum number of LLM extraction + validation attempts
            before giving up.  Defaults to ``3``.
    """

    def __init__(self, max_retries: int = 3) -> None:
        self.max_retries = max_retries
        self._distiller = Distiller()
        self._brain = Brain()
        self._validator = Validator()

    async def run(
        self,
        url: str,
        schema_description: str,
        expect_list: bool = True,
        scroll: bool = True,
        max_scrolls: int = 5,
        headless: bool = True,
    ) -> dict[str, Any]:
        """Fetch *url*, extract data matching *schema_description*, and return it.

        The method executes the following pipeline steps:

        1. **Navigator** — fetch the fully-rendered HTML.
        2. **Distiller** — strip noise and produce clean text.
        3. **Brain** — ask the Groq LLM to extract JSON matching the schema.
        4. **Validator** — parse and validate the JSON; on failure, feed the
           error back to the LLM and retry (up to *max_retries* times).
        5. Return a result envelope.

        Args:
            url: The target URL to scrape.
            schema_description: Natural-language description of the data to
                extract.  Example: ``"A JSON array of objects, each with keys
                'title' (str) and 'price' (str)."``.
            expect_list: If ``True`` (default), the LLM output must be a
                non-empty JSON array.  Set to ``False`` for single-object
                extraction.

        Returns:
            A ``dict`` with the following keys:

            * ``url`` (*str*) — the scraped URL.
            * ``items_count`` (*int*) — number of extracted items (1 for
              non-list results).
            * ``data`` (*Any*) — the validated, parsed data.

        Raises:
            RuntimeError: If all retry attempts are exhausted without
                producing valid data.
        """
        # ── Step 1: Fetch ────────────────────────────────────────────────────
        logger.info(
            "[1/5] Navigator: Fetching %s (scroll=%s, max_scrolls=%d)",
            url,
            scroll,
            max_scrolls,
        )
        async with Navigator(headless=headless) as nav:
            raw_html: str = await nav.fetch(
                url, scroll=scroll, max_scrolls=max_scrolls
            )

        # ── Step 2: Distil ───────────────────────────────────────────────────
        logger.info(
            "[2/5] Distiller: Cleaning HTML (%d chars raw)", len(raw_html)
        )
        cleaned: str = self._distiller.distill(raw_html)
        logger.info("       %d chars after distillation", len(cleaned))

        # ── Step 3: LLM extraction with self-healing retry loop ──────────────
        logger.info("[3/5] Brain: Sending to Groq LLM")

        validated_data: Any = None
        previous_error: str | None = None
        last_error: str = ""

        for attempt in range(self.max_retries):
            raw_response: str = self._brain.extract(
                cleaned_text=cleaned,
                schema_description=schema_description,
                previous_error=previous_error,
            )

            logger.info(
                "[4/5] Validator: Checking AI output (attempt %d/%d)",
                attempt + 1,
                self.max_retries,
            )

            try:
                validated_data = self._validator.run_all(
                    raw_response, expect_list=expect_list
                )
                logger.info("[5/5] ✓ Data validated and extracted successfully.")
                break

            except ValidationError as e:
                last_error = str(e)
                logger.warning(
                    "Attempt %d failed: %s", attempt + 1, last_error
                )
                previous_error = last_error
                # continue to next attempt
        else:
            raise RuntimeError(
                f"Failed to extract valid data after {self.max_retries} attempts. "
                f"Last error: {last_error}"
            )

        items_count: int = (
            len(validated_data) if isinstance(validated_data, list) else 1
        )

        return {
            "url": url,
            "items_count": items_count,
            "data": validated_data,
        }
