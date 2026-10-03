import pytest
from fastapi.testclient import TestClient

import api.main as api_main


class FakePipeline:
    """Stands in for ScraperPipeline so no browser or LLM is needed."""

    last_kwargs = {}
    result = {"url": "https://example.com", "items_count": 1, "data": [{"x": 1}], "warnings": []}
    error = None

    def __init__(self, **kwargs):
        FakePipeline.last_kwargs = kwargs

    async def run(self, *args, **kwargs):
        if FakePipeline.error:
            raise FakePipeline.error
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
