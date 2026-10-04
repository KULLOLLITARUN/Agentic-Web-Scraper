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
        {"type": "step", "step": "fetch", "page": 1, "max_pages": 1, "url": "https://example.com"},
        {"type": "step", "step": "distill", "html_chars": len(PAGE)},
        {"type": "step", "step": "infer", "text_chars": len("Item one\nItem two"), "attempt": 1, "max_attempts": 3},
        {"type": "step", "step": "validate", "attempt": 1, "max_attempts": 3},
        {"type": "page_done", "page": 1, "items": 1, "total_items": 1},
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


def test_warns_when_model_reports_length_limit_even_if_json_parses():
    # The reply ended right after a closing bracket, so nothing needed repair,
    # but finish_reason said the output hit the token limit.
    p = ScraperPipeline(api_key="test-key")
    p._brain = FakeBrain(['[{"name": "Item one"}]'])
    p._brain.truncated = True
    result = asyncio.run(p.run("https://example.com", "name (string)"))

    assert len(result["warnings"]) == 1
    assert "length limit after 1 complete items" in result["warnings"][0]


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


# ── Multiple pages ──────────────────────────────────────────────────────────
class PagedNavigator(FakeNavigator):
    """Serves a small paginated site; "/boom" raises like a failed page load."""

    pages = {}

    async def fetch(self, url, **_):
        if url.endswith("/boom"):
            raise RuntimeError("net::ERR_CONNECTION_RESET")
        return self.pages[url]


def page_html(name, next_href=None):
    nav = f'<li class="next"><a href="{next_href}">next</a></li>' if next_href else ""
    return f"<main><p>{name}</p><ul>{nav}</ul></main>"


def run_pages(monkeypatch, pages, replies, max_pages, expect_list=True):
    PagedNavigator.pages = pages
    monkeypatch.setattr(pipeline_module, "Navigator", PagedNavigator)
    p = ScraperPipeline(api_key="test-key")
    p._brain = FakeBrain(replies)
    events = []
    result = asyncio.run(
        p.run("https://site.test/1", "name (string)", expect_list=expect_list,
              on_event=events.append, max_pages=max_pages)
    )
    return result, events


SITE = {
    "https://site.test/1": page_html("one", "/2"),
    "https://site.test/2": page_html("two", "3"),
    "https://site.test/3": page_html("three"),
}


def test_follows_next_links_and_combines_items(monkeypatch):
    result, events = run_pages(
        monkeypatch, SITE, ['[{"name": "one"}]', '[{"name": "two"}]', '[{"name": "three"}]'], max_pages=5
    )

    assert result["data"] == [{"name": "one"}, {"name": "two"}, {"name": "three"}]
    assert result["items_count"] == 3
    assert result["pages_scraped"] == 3  # stopped early: page 3 has no next link
    fetches = [(e["page"], e["url"]) for e in events if e.get("step") == "fetch"]
    assert fetches == [(1, "https://site.test/1"), (2, "https://site.test/2"), (3, "https://site.test/3")]
    pages = [(e["page"], e["items"], e["total_items"]) for e in events if e["type"] == "page_done"]
    assert pages == [(1, 1, 1), (2, 1, 2), (3, 1, 3)]


def test_stops_at_max_pages(monkeypatch):
    result, _ = run_pages(monkeypatch, SITE, ['[{"name": "one"}]', '[{"name": "two"}]'], max_pages=2)

    assert result["pages_scraped"] == 2
    assert result["data"] == [{"name": "one"}, {"name": "two"}]


def test_does_not_loop_on_a_next_link_back_to_a_visited_page(monkeypatch):
    site = {"https://site.test/1": page_html("one", "/2"), "https://site.test/2": page_html("two", "/1")}
    result, _ = run_pages(monkeypatch, site, ['[{"name": "one"}]', '[{"name": "two"}]'], max_pages=10)

    assert result["pages_scraped"] == 2


def test_later_page_failure_keeps_earlier_items(monkeypatch):
    site = {"https://site.test/1": page_html("one", "/boom")}
    result, _ = run_pages(monkeypatch, site, ['[{"name": "one"}]'], max_pages=3)

    assert result["data"] == [{"name": "one"}]
    assert result["pages_scraped"] == 1
    assert result["warnings"] == [
        "Stopped after page 1: page 2 (https://site.test/boom) failed: net::ERR_CONNECTION_RESET"
    ]


def test_first_page_failure_still_raises(monkeypatch):
    site = {"https://site.test/1": page_html("one")}
    with pytest.raises(RuntimeError, match="after 3 attempts"):
        run_pages(monkeypatch, site, ["bad", "bad", "bad"], max_pages=3)


def test_page_warnings_say_which_page(monkeypatch):
    result, _ = run_pages(
        monkeypatch, SITE, ['[{"name": "one"}]', '[{"name": "two"}, {"name": "tr'], max_pages=2
    )

    assert len(result["warnings"]) == 1
    assert result["warnings"][0].startswith("Page 2: The model's output hit its length limit")


def test_single_object_reads_only_the_first_page(monkeypatch):
    result, _ = run_pages(monkeypatch, SITE, ['{"name": "one"}'], max_pages=5, expect_list=False)

    assert result["data"] == {"name": "one"}
    assert result["pages_scraped"] == 1


def test_warns_when_a_fallback_model_answered():
    p = ScraperPipeline(api_key="test-key")
    p._brain = FakeBrain(['[{"name": "Item one"}]'])
    p._brain.preferred_model = "openai/gpt-oss-120b"
    p._brain.model_used = "openai/gpt-oss-20b"
    result = asyncio.run(p.run("https://example.com", "name (string)"))

    assert len(result["warnings"]) == 1
    assert "gpt-oss-20b answered instead" in result["warnings"][0]


def test_no_fallback_warning_when_preferred_model_answered():
    p = ScraperPipeline(api_key="test-key")
    p._brain = FakeBrain(['[{"name": "Item one"}]'])
    p._brain.preferred_model = p._brain.model_used = "openai/gpt-oss-120b"
    result = asyncio.run(p.run("https://example.com", "name (string)"))

    assert result["warnings"] == []
