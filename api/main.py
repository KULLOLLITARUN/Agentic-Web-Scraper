"""
FastAPI REST server for the AI Web Scraper.

Exposes endpoints for health-checking and triggering the adaptive
scraping pipeline via HTTP POST requests.
"""

import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Ensure the project root is on the path so `scraper` is importable whether
# this module is launched directly (uvicorn api.main:app) or via the CLI.
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from scraper.pipeline import ScraperPipeline  # noqa: E402

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class ScrapeRequest(BaseModel):
    """Request body for the /scrape endpoint."""

    url: str = Field(
        ...,
        example="https://quotes.toscrape.com",
        description="The target URL to scrape.",
    )
    schema_description: str = Field(
        ...,
        example=(
            "Extract all quotes. Each item should have: "
            "text (string), author (string), tags (list of strings)"
        ),
        description="Plain-English description of the data schema to extract.",
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


class ScrapeResponse(BaseModel):
    """Response body returned by the /scrape endpoint."""

    success: bool = Field(..., description="Whether the scrape completed successfully.")
    url: str = Field(..., description="The URL that was scraped.")
    items_count: int = Field(..., description="Number of items extracted.")
    data: list | dict = Field(..., description="The extracted data payload.")
    elapsed_seconds: float = Field(..., description="Wall-clock time taken in seconds.")
    error: str | None = Field(default=None, description="Error message if the scrape failed.")


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
        pipeline = ScraperPipeline(max_retries=request.max_retries)
        result = await pipeline.run(
            request.url,
            request.schema_description,
            request.expect_list,
            scroll=request.scroll,
            max_scrolls=request.max_scrolls,
        )
        return ScrapeResponse(
            success=True,
            url=result["url"],
            items_count=result["items_count"],
            data=result["data"],
            elapsed_seconds=round(time.time() - start, 2),
        )
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
                error=str(e),
            ).model_dump(),
        )
