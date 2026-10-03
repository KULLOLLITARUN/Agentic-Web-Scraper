import asyncio

import pytest

from scraper import pipeline as pipeline_module
from scraper.pipeline import ScraperPipeline


PAGE = "<main><p>Item one</p><p>Item two</p></main>"


class FakeNavigator:
    def __init__(self, **_):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return None

    async def fetch(self, url, **_):
        return PAGE


class FakeBrain:
    """Replies with each queued response in turn."""

    def __init__(self, replies):
        self.replies = list(replies)

    async def extract(self, **_):
        return self.replies.pop(0)


@pytest.fixture(autouse=True)
def fake_navigator(monkeypatch):
    monkeypatch.setattr(pipeline_module, "Navigator", FakeNavigator)


def run(replies, max_retries=3):
    p = ScraperPipeline(max_retries=max_retries, api_key="test-key")
    p._brain = FakeBrain(replies)
    events = []
    result = asyncio.run(p.run("https://example.com", "name (string)", on_event=events.append))
    return result, events, p


def test_emits_each_step_in_order():
    result, events, p = run(['[{"name": "Item one"}]'])

    assert events == [
        {"type": "step", "step": "fetch"},
        {"type": "step", "step": "distill", "html_chars": len(PAGE)},
        {"type": "step", "step": "infer", "text_chars": len("Item one\nItem two"), "attempt": 1, "max_attempts": 3},
        {"type": "step", "step": "validate", "attempt": 1, "max_attempts": 3},
        {"type": "step", "step": "done"},
    ]
    assert result["items_count"] == 1
    assert p.step == "done"


def test_emits_retry_with_reason_then_succeeds():
    result, events, _ = run(["not json", '[{"name": "Item one"}]'])

    retries = [e for e in events if e["type"] == "retry"]
    assert len(retries) == 1
    assert retries[0]["attempt"] == 1
    assert "Invalid JSON" in retries[0]["error"]
    assert [e["attempt"] for e in events if e.get("step") == "infer"] == [1, 2]
    assert result["items_count"] == 1


def test_emits_warning_when_output_was_cut_off():
    result, events, _ = run(['[{"name": "Item one"}, {"name": "Ite'])

    warnings = [e["message"] for e in events if e["type"] == "warning"]
    assert len(warnings) == 1
    assert warnings == result["warnings"]


def test_step_shows_where_it_failed_after_retries_run_out():
    p = ScraperPipeline(max_retries=2, api_key="test-key")
    p._brain = FakeBrain(["nope", "still nope"])

    with pytest.raises(RuntimeError, match="after 2 attempts"):
        asyncio.run(p.run("https://example.com", "name (string)"))
    assert p.step == "validate"


def test_runs_without_a_callback():
    p = ScraperPipeline(api_key="test-key")
    p._brain = FakeBrain(['[{"name": "Item one"}]'])

    assert asyncio.run(p.run("https://example.com", "name (string)"))["items_count"] == 1


def test_field_mismatch_is_retried_with_the_problems():
    result, events, _ = run(['[{"title": "wrong key"}]', '[{"name": "Item one"}]'])

    retries = [e for e in events if e["type"] == "retry"]
    assert len(retries) == 1
    assert 'missing "name"' in retries[0]["error"]
    assert result["data"] == [{"name": "Item one"}]
    assert result["warnings"] == []


def test_field_mismatch_on_last_attempt_keeps_data_with_warning():
    result, events, _ = run(['[{"name": 5, "x": 1}, {"x": 2}]'], max_retries=1)

    assert result["data"] == [{"name": "5", "x": 1}, {"x": 2}]
    assert len(result["warnings"]) == 1
    assert 'item 2: missing "name"' in result["warnings"][0]
    assert [e["message"] for e in events if e["type"] == "warning"] == result["warnings"]
