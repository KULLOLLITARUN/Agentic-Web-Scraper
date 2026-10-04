"""
FastAPI REST server for the AI Web Scraper.

Exposes endpoints for health-checking and triggering the adaptive
scraping pipeline via HTTP POST requests.
"""

import asyncio
import json
import logging
import os
import re
import sys
import time
from datetime import datetime

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Ensure the project root is on the path so `scraper` is importable whether
# this module is launched directly (uvicorn api.main:app) or via the CLI.
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from scraper.pipeline import ScraperPipeline  # noqa: E402

import groq  # noqa: E402

# Model ids and account ids never reach the UI ("model `openai/gpt-oss-120b`
# in organization `org_...`" is in Groq's rate-limit messages).
_MODEL_ID_RE = re.compile(r"`?\b(?:openai/|qwen/|meta-llama/)?(?:gpt-oss|qwen|llama)\b[\w.\-/]*`?", re.IGNORECASE)
_ORG_RE = re.compile(r"\s*in organization `?org_\w+`?", re.IGNORECASE)


def public_error(error: Exception) -> str:
    """A message for the UI: plain words, without model names or account ids."""
    if isinstance(error, (groq.RateLimitError,)) or (
        isinstance(error, groq.APIStatusError) and error.status_code == 413
    ):
        return ("The AI service's usage limit was reached. Try again in a minute; "
                "the daily limit resets over the day.")
    if isinstance(error, (groq.AuthenticationError, groq.PermissionDeniedError)):
        return "The AI service rejected the API key. Check GROQ_API_KEY in .env, or the key in Settings."
    if isinstance(error, groq.APIConnectionError):
        return "Couldn't reach the AI service. Check the internet connection and try again."
    if isinstance(error, groq.APIError):
        return "The AI service returned an error. Try again in a moment."
    message = _ORG_RE.sub("", str(error))
    return _MODEL_ID_RE.sub("the AI model", message)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="AI Web Scraper",
    description="Adaptive AI-powered web scraper that self-heals on layout changes",
    version="1.0.0",
)

# Only the local frontend (any port) may call the API from a browser, so a
# website the user happens to visit can't run scrapes on their Groq key.
# A deployed frontend is added with CORS_ORIGINS (comma-separated).
LOCAL_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1)(:\d+)?"


def allowed_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "")
    return [origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    allow_origin_regex=LOCAL_ORIGIN_REGEX,
    allow_credentials=False,  # the frontend sends no cookies
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class ScrapeRequest(BaseModel):
    """Request body for the /scrape endpoint."""

    url: str = Field(
        ...,
        examples=["https://quotes.toscrape.com"],
        description="The target URL to scrape.",
    )
    schema_description: str | None = Field(
        default=None,
        description="Plain-English description of the data schema to extract.",
    )
    instruction: str | None = Field(
        default=None,
        description="Alias for schema_description.",
    )
    max_retries: int = Field(
        default=3,
        ge=1,
        le=10,
        description="Maximum number of self-healing retry attempts.",
    )
    expect_list: bool = Field(
        default=True,
        description="Whether the extracted result is expected to be a list of items.",
    )
    scroll: bool = Field(
        default=True,
        description="Whether to perform dynamic auto-scrolling to trigger lazy loading.",
    )
    max_scrolls: int = Field(
        default=5,
        ge=0,
        le=20,
        description="Maximum number of scroll steps for dynamic/lazy-loaded content.",
    )
    headless: bool = Field(
        default=True,
        description="If False, launches visible Chrome to bypass Akamai/Cloudflare WAFs (e.g. for Naukri).",
    )
    screenshots: bool = Field(
        default=True,
        description="Stream a JPEG of each page's top as a 'screenshot' event (/scrape/stream only).",
    )
    max_pages: int = Field(
        default=1,
        ge=1,
        le=50,
        description="Follow 'next page' links up to this many pages and combine the items. List results only.",
    )
    model: str | None = Field(
        default=None,
        description="Preferred Groq model, tried before the failover pool. Defaults to the pool order.",
    )
    api_key: str | None = Field(
        default=None,
        description="Groq API key override. Defaults to GROQ_API_KEY from the server environment.",
    )
    max_chars: int | None = Field(
        default=None,
        ge=1000,
        le=200_000,
        description="Maximum characters of page text read. Longer pages are sent to the model in parts of 12,000. Defaults to 40,000.",
    )


class ScrapeResponse(BaseModel):
    """Response body returned by the /scrape endpoint."""

    success: bool = Field(..., description="Whether the scrape completed successfully.")
    url: str = Field(..., description="The URL that was scraped.")
    items_count: int = Field(..., description="Number of items extracted.")
    data: list | dict = Field(..., description="The extracted data payload.")
    elapsed_seconds: float = Field(..., description="Wall-clock time taken in seconds.")
    pages_scraped: int = Field(default=1, description="How many pages were read.")
    error: str | None = Field(default=None, description="Error message if the scrape failed.")
    warnings: list[str] = Field(
        default_factory=list,
        description="Reasons the data may be incomplete, e.g. page or model output was cut off.",
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/", summary="Root health check")
async def root() -> dict:
    """Return a simple status message confirming the API is live."""
    return {
        "status": "ok",
        "message": "AI Web Scraper is running. POST to /scrape to extract data.",
        "docs": "/docs",
    }


@app.get("/health", summary="Detailed health check")
async def health() -> dict:
    """Return a detailed health status with the current UTC timestamp."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.post(
    "/scrape",
    response_model=ScrapeResponse,
    summary="Run the AI scraping pipeline",
    responses={200: {"description": "Extracted data as JSON"}},
)
async def scrape(request: ScrapeRequest) -> ScrapeResponse:
    """
    Trigger the AI scraping pipeline for a given URL and data schema.

    The pipeline will:
    1. Fetch the target page.
    2. Ask an LLM to generate a CSS/extraction strategy based on the schema.
    3. Extract structured data.
    4. Self-heal and retry up to `max_retries` times if extraction fails or
       the resulting structure does not match the expected schema.

    Parameters
    ----------
    request : ScrapeRequest
        The scrape configuration including URL, schema description, and options.

    Returns
    -------
    ScrapeResponse
        The extracted data together with metadata such as item count and
        elapsed time.
    """
    start = time.time()
    try:
        return await _run_scrape(_build_pipeline(request), request, start)
    except Exception as e:
        logger.error("Scrape failed for %s: %s", request.url, e, exc_info=True)
        return JSONResponse(
            status_code=500,
            content=ScrapeResponse(
                success=False,
                url=request.url,
                items_count=0,
                data=[],
                elapsed_seconds=round(time.time() - start, 2),
                error=public_error(e),
            ).model_dump(),
        )


@app.post(
    "/scrape/stream",
    summary="Run the scraping pipeline and stream progress",
    responses={200: {"description": "Newline-delimited JSON progress events", "content": {"application/x-ndjson": {}}}},
)
async def scrape_stream(request: ScrapeRequest) -> StreamingResponse:
    """
    Same as `/scrape`, but streams one JSON object per line as the pipeline runs.

    Event types:
    - `step` — a step started: `fetch`, `distill`, `infer`, `validate` or `done`
      (`infer`/`validate` include `attempt` and `max_attempts`).
    - `retry` — an attempt failed validation; `error` says why.
    - `warning` — the data may be incomplete; `message` says why.
    - `result` — final event on success; same fields as the `/scrape` response.
    - `error` — final event on failure, with `message` and the failed `step`.

    Closing the connection cancels the scrape.
    """
    queue: asyncio.Queue[dict | None] = asyncio.Queue()

    async def worker() -> None:
        start = time.time()
        pipeline = None
        try:
            pipeline = _build_pipeline(request)
            response = await _run_scrape(pipeline, request, start, on_event=queue.put_nowait)
            queue.put_nowait({"type": "result", **response.model_dump()})
        except asyncio.CancelledError:
            logger.info(
                "Scrape cancelled for %s during %s (client disconnected)",
                request.url,
                pipeline.step if pipeline else "setup",
            )
            raise
        except Exception as e:
            logger.error("Scrape failed for %s: %s", request.url, e, exc_info=True)
            queue.put_nowait({
                "type": "error",
                "step": pipeline.step if pipeline else "idle",
                "message": public_error(e),
                "elapsed_seconds": round(time.time() - start, 2),
            })
        finally:
            queue.put_nowait(None)

    async def events():
        task = asyncio.create_task(worker())
        try:
            while (event := await queue.get()) is not None:
                yield json.dumps(event) + "\n"
        finally:
            # Client went away mid-scrape: stop the browser and LLM calls too.
            if not task.done():
                task.cancel()

    return StreamingResponse(events(), media_type="application/x-ndjson")


def _build_pipeline(request: ScrapeRequest) -> ScraperPipeline:
    return ScraperPipeline(
        max_retries=request.max_retries,
        model=request.model or None,
        api_key=request.api_key or None,
        max_chars=request.max_chars,
    )


async def _run_scrape(pipeline: ScraperPipeline, request: ScrapeRequest, start: float, on_event=None) -> ScrapeResponse:
    target_schema = request.schema_description or request.instruction or "Extract structured data from the page"
    result = await pipeline.run(
        request.url,
        target_schema,
        request.expect_list,
        scroll=request.scroll,
        max_scrolls=request.max_scrolls,
        headless=request.headless,
        on_event=on_event,
        max_pages=request.max_pages,
        screenshots=request.screenshots and on_event is not None,
    )
    return ScrapeResponse(
        success=True,
        url=result["url"],
        items_count=result["items_count"],
        data=result["data"],
        elapsed_seconds=round(time.time() - start, 2),
        pages_scraped=result.get("pages_scraped", 1),
        warnings=result["warnings"],
    )
