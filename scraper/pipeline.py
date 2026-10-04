"""
pipeline.py
~~~~~~~~~~~
Main orchestrator: wires Navigator → Distiller → Brain → Validator together
with an agentic self-healing retry loop, optionally across several pages.
"""

import asyncio
import logging
from typing import Any, Callable

from scraper.navigator import Navigator
from scraper.distiller import Distiller, wanted_attributes
from scraper.brain import Brain
from scraper.pagination import find_next_page
from scraper.validator import SchemaMismatchError, Validator, ValidationError

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

    def __init__(
        self,
        max_retries: int = 3,
        model: str | None = None,
        api_key: str | None = None,
        max_chars: int | None = None,
    ) -> None:
        self.max_retries = max_retries
        self._distiller = Distiller(max_chars) if max_chars else Distiller()
        self._brain = Brain(api_key=api_key, model=model)
        self._validator = Validator()
        #: The step currently running (fetch, distill, infer, validate, done).
        self.step = "idle"
        self._on_event: Callable[[dict[str, Any]], None] | None = None

    def _emit(self, event_type: str, **fields: Any) -> None:
        """Report progress to the ``on_event`` callback, if one was given."""
        if event_type == "step":
            self.step = fields["step"]
        if self._on_event is not None:
            self._on_event({"type": event_type, **fields})

    def _warn(self, warnings: list[str], message: str) -> None:
        warnings.append(message)
        logger.warning(message)
        self._emit("warning", message=message)

    async def run(
        self,
        url: str,
        schema_description: str,
        expect_list: bool = True,
        scroll: bool = True,
        max_scrolls: int = 5,
        headless: bool = True,
        on_event: Callable[[dict[str, Any]], None] | None = None,
        max_pages: int = 1,
    ) -> dict[str, Any]:
        """Fetch *url*, extract data matching *schema_description*, and return it.

        For each page (up to *max_pages*, following "next page" links):

        1. **Navigator** — fetch the fully-rendered HTML.
        2. **Distiller** — strip noise and produce clean text.
        3. **Brain** — ask the Groq LLM to extract JSON matching the schema.
        4. **Validator** — parse and validate the JSON; on failure, feed the
           error back to the LLM and retry (up to *max_retries* times).

        Items from every page are combined into one list.

        Args:
            url: The target URL to scrape.
            schema_description: Natural-language description of the data to
                extract.  Example: ``"A JSON array of objects, each with keys
                'title' (str) and 'price' (str)."``.
            expect_list: If ``True`` (default), the LLM output must be a
                non-empty JSON array.  Set to ``False`` for single-object
                extraction (which only ever reads the first page).
            on_event: Optional callback receiving progress events as they
                happen: ``{"type": "step", "step": ...}`` when a step starts
                (``fetch`` also carries ``page``, ``max_pages`` and ``url``),
                ``{"type": "retry", ...}`` when an attempt fails validation,
                ``{"type": "page_done", "page", "items", "total_items"}`` after
                each page and ``{"type": "warning", "message": ...}`` for
                incomplete data.
            max_pages: How many pages to read by following "next" links.
                Stops early when there is no next link.

        Returns:
            A ``dict`` with the following keys:

            * ``url`` (*str*) — the scraped URL.
            * ``items_count`` (*int*) — number of extracted items (1 for
              non-list results).
            * ``data`` (*Any*) — the validated, parsed data.
            * ``pages_scraped`` (*int*) — how many pages were read.
            * ``warnings`` (*list[str]*) — reasons the data may be incomplete
              (page text cut off, model output cut off, a later page failed).

        Raises:
            RuntimeError: If the first page can't be extracted after all
                retry attempts.  A failure on a later page stops pagination
                with a warning instead, keeping the items found so far.
        """
        self._on_event = on_event
        max_pages = max_pages if expect_list else 1
        multi = max_pages > 1

        items: list[Any] = []
        single: Any = None
        warnings: list[str] = []
        visited: set[str] = set()
        page_url: str | None = url
        pages_scraped = 0

        async with Navigator(headless=headless) as nav:
            while page_url and pages_scraped < max_pages:
                page = pages_scraped + 1
                visited.add(page_url)
                prefix = f"Page {page}: " if multi else ""
                try:
                    data, raw_html, page_warnings = await self._scrape_page(
                        nav, page_url, page, max_pages, schema_description,
                        expect_list, scroll, max_scrolls,
                    )
                except Exception as e:
                    if page == 1:
                        raise
                    self._warn(warnings, f"Stopped after page {page - 1}: page {page} ({page_url}) failed: {e}")
                    break

                pages_scraped = page
                for message in page_warnings:
                    self._warn(warnings, prefix + message)
                if expect_list:
                    items.extend(data)
                else:
                    single = data
                self._emit(
                    "page_done", page=page, items=len(data) if expect_list else 1,
                    total_items=len(items) if expect_list else 1,
                )

                page_url = self._next_page(raw_html, page_url, visited) if page < max_pages else None

        self._emit("step", step="done")

        data = items if expect_list else single
        return {
            "url": url,
            "items_count": len(items) if expect_list else 1,
            "data": data,
            "pages_scraped": pages_scraped,
            "warnings": warnings,
        }

    @staticmethod
    def _next_page(raw_html: str, page_url: str, visited: set[str]) -> str | None:
        """The next unvisited page linked from this one, if any."""
        next_url = find_next_page(raw_html, page_url)
        if next_url is None or next_url in visited:
            logger.info("No new next page after %s; stopping.", page_url)
            return None
        return next_url

    async def _scrape_page(
        self,
        nav: Navigator,
        url: str,
        page: int,
        max_pages: int,
        schema_description: str,
        expect_list: bool,
        scroll: bool,
        max_scrolls: int,
    ) -> tuple[Any, str, list[str]]:
        """Fetch, distil and extract one page. Returns ``(data, raw_html, warnings)``."""
        # ── Step 1: Fetch ────────────────────────────────────────────────────
        self._emit("step", step="fetch", page=page, max_pages=max_pages, url=url)
        logger.info(
            "[1/5] Navigator: Fetching %s (page %d/%d, scroll=%s, max_scrolls=%d)",
            url,
            page,
            max_pages,
            scroll,
            max_scrolls,
        )
        raw_html: str = await nav.fetch(url, scroll=scroll, max_scrolls=max_scrolls)

        # ── Step 2: Distil ───────────────────────────────────────────────────
        logger.info("[2/5] Distiller: Cleaning HTML (%d chars raw)", len(raw_html))
        self._emit("step", step="distill", html_chars=len(raw_html))
        # BeautifulSoup parsing is CPU-bound; keep it off the event loop.
        cleaned: str = await asyncio.to_thread(
            self._distiller.distill, raw_html, url, **wanted_attributes(schema_description)
        )
        logger.info("       %d chars after distillation", len(cleaned))

        warnings: list[str] = []
        if self._distiller.truncated:
            warnings.append(
                f"Page text was cut off at {self._distiller.max_chars:,} of "
                f"{self._distiller.full_length:,} characters, so items further "
                "down the page may be missing. Raise 'Max page text' in Settings."
            )

        # ── Steps 3–4: LLM extraction with self-healing retry loop ───────────
        data = await self._extract(cleaned, schema_description, expect_list, warnings)

        # finish_reason == "length" is the direct signal; the repair flag also
        # covers replies that ended mid-JSON for any other reason.
        if getattr(self._brain, "truncated", False) or self._validator.repaired:
            count = len(data) if isinstance(data, list) else 1
            warnings.append(
                f"The model's output hit its length limit after {count} complete items; "
                "any items after those are missing."
            )
        return data, raw_html, warnings

    async def _extract(
        self,
        cleaned: str,
        schema_description: str,
        expect_list: bool,
        warnings: list[str],
    ) -> Any:
        """Ask the LLM for JSON and validate it, retrying with the error as feedback."""
        logger.info("[3/5] Brain: Sending to Groq LLM")
        previous_error: str | None = None
        last_error = ""

        for attempt in range(self.max_retries):
            progress = {"attempt": attempt + 1, "max_attempts": self.max_retries}
            self._emit("step", step="infer", text_chars=len(cleaned), **progress)
            raw_response: str = await self._brain.extract(
                cleaned_text=cleaned,
                schema_description=schema_description,
                previous_error=previous_error,
            )

            logger.info("[4/5] Validator: Checking AI output (attempt %d/%d)", attempt + 1, self.max_retries)
            self._emit("step", step="validate", **progress)
            try:
                data = self._validator.run_all(
                    raw_response, expect_list=expect_list, schema_description=schema_description
                )
                logger.info("[5/5] ✓ Data validated and extracted successfully.")
                return data

            except ValidationError as e:
                if isinstance(e, SchemaMismatchError) and attempt + 1 == self.max_retries:
                    # Out of retries but the data is usable: keep it and say what's off.
                    shown = "; ".join(e.problems[:3])
                    more = f" (and {len(e.problems) - 3} more)" if len(e.problems) > 3 else ""
                    warnings.append(
                        f"Some values still didn't match your fields after {self.max_retries} "
                        f"attempts: {shown}{more}."
                    )
                    return e.data
                last_error = str(e)
                logger.warning("Attempt %d failed: %s", attempt + 1, last_error)
                previous_error = last_error
                self._emit("retry", error=last_error, **progress)

        raise RuntimeError(
            f"Failed to extract valid data after {self.max_retries} attempts. "
            f"Last error: {last_error}"
        )
