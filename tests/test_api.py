import json

import pytest
from fastapi.testclient import TestClient

import api.main as api_main


class FakePipeline:
    """Stands in for ScraperPipeline so no browser or LLM is needed."""

    last_kwargs = {}
    last_run_kwargs = {}
    result = {"url": "https://example.com", "items_count": 1, "data": [{"x": 1}], "warnings": []}
    error = None

    def __init__(self, **kwargs):
        FakePipeline.last_kwargs = kwargs
        self.step = "idle"

    async def run(self, *args, on_event=None, **kwargs):
        FakePipeline.last_run_kwargs = kwargs
        emit = on_event or (lambda event: None)
        for step in ("fetch", "distill"):
            self.step = step
            emit({"type": "step", "step": step})
        if FakePipeline.error:
            raise FakePipeline.error
        emit({"type": "step", "step": "done"})
        return FakePipeline.result


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(api_main, "ScraperPipeline", FakePipeline)
    FakePipeline.error = None
    FakePipeline.result = {"url": "https://example.com", "items_count": 1, "data": [{"x": 1}], "warnings": []}
    return TestClient(api_main.app)


def test_settings_are_passed_to_pipeline(client):
    r = client.post(
        "/scrape",
        json={
            "url": "https://example.com",
            "instruction": "x",
            "model": "openai/gpt-oss-20b",
            "api_key": "k",
            "max_chars": 30000,
        },
    )

    assert r.status_code == 200
    assert FakePipeline.last_kwargs == {
        "max_retries": 3,
        "model": "openai/gpt-oss-20b",
        "api_key": "k",
        "max_chars": 30000,
    }


def test_blank_settings_fall_back_to_server_defaults(client):
    client.post("/scrape", json={"url": "https://example.com", "model": "", "api_key": "", "max_chars": None})

    assert FakePipeline.last_kwargs["model"] is None
    assert FakePipeline.last_kwargs["api_key"] is None
    assert FakePipeline.last_kwargs["max_chars"] is None


def test_warnings_are_returned(client):
    FakePipeline.result = {**FakePipeline.result, "warnings": ["page cut off"]}
    r = client.post("/scrape", json={"url": "https://example.com"})

    assert r.json()["warnings"] == ["page cut off"]


@pytest.mark.parametrize("max_chars", [10, 10_000_000])
def test_out_of_range_max_chars_rejected(client, max_chars):
    r = client.post("/scrape", json={"url": "https://example.com", "max_chars": max_chars})

    assert r.status_code == 422


def test_pipeline_failure_returns_500_with_message(client):
    FakePipeline.error = RuntimeError("all retries failed")
    r = client.post("/scrape", json={"url": "https://example.com"})

    assert r.status_code == 500
    assert r.json()["success"] is False
    assert r.json()["error"] == "all retries failed"


def stream(client, **body):
    r = client.post("/scrape/stream", json={"url": "https://example.com", **body})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/x-ndjson")
    return [json.loads(line) for line in r.text.splitlines() if line]


def test_stream_reports_steps_then_result(client):
    events = stream(client)

    assert [e.get("step") for e in events if e["type"] == "step"] == ["fetch", "distill", "done"]
    assert events[-1]["type"] == "result"
    assert events[-1]["success"] is True
    assert events[-1]["data"] == [{"x": 1}]


def test_stream_reports_failed_step(client):
    FakePipeline.error = RuntimeError("model said no")
    events = stream(client)

    assert events[-1] == {
        "type": "error",
        "step": "distill",
        "message": "model said no",
        "elapsed_seconds": events[-1]["elapsed_seconds"],
    }


def test_max_pages_is_passed_to_pipeline_and_pages_scraped_returned(client):
    FakePipeline.result = {**FakePipeline.result, "pages_scraped": 4}
    r = client.post("/scrape", json={"url": "https://example.com", "max_pages": 5})

    assert FakePipeline.last_run_kwargs["max_pages"] == 5
    assert r.json()["pages_scraped"] == 4


def test_max_pages_defaults_to_one(client):
    client.post("/scrape", json={"url": "https://example.com"})

    assert FakePipeline.last_run_kwargs["max_pages"] == 1


@pytest.mark.parametrize("max_pages", [0, 51])
def test_out_of_range_max_pages_rejected(client, max_pages):
    r = client.post("/scrape", json={"url": "https://example.com", "max_pages": max_pages})

    assert r.status_code == 422


def preflight(client, origin):
    return client.options(
        "/scrape/stream",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )


@pytest.mark.parametrize(
    "origin", ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5190", "http://localhost"]
)
def test_cors_allows_local_frontend(client, origin):
    response = preflight(client, origin)

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
    assert "access-control-allow-credentials" not in response.headers


@pytest.mark.parametrize(
    "origin", ["https://evil.example", "http://localhost.evil.example", "http://127.0.0.1.evil.example:5173"]
)
def test_cors_blocks_other_sites(client, origin):
    response = preflight(client, origin)

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_cors_origins_env_is_parsed(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", " https://scraper.example.com/ , https://b.example ,")

    assert api_main.allowed_origins() == ["https://scraper.example.com", "https://b.example"]


def test_public_error_hides_model_and_account_ids():
    raw = RuntimeError("Rate limit reached for model `openai/gpt-oss-120b` in organization `org_01abc` on tokens")
    message = api_main.public_error(raw)

    assert "gpt-oss" not in message and "org_" not in message
    assert api_main.public_error(RuntimeError("Page returned HTTP 404")) == "Page returned HTTP 404"


def test_stream_error_event_is_sanitised(client):
    FakePipeline.error = RuntimeError("qwen/qwen3.8-27b failed")
    response = client.post("/scrape/stream", json={"url": "https://example.com", "schema_description": "x"})
    events = [json.loads(line) for line in response.text.splitlines() if line.strip()]

    error = [e for e in events if e["type"] == "error"][0]
    assert "qwen" not in error["message"]
