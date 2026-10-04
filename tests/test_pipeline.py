import json
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
    assert "a backup model answered instead" in result["warnings"][0]
    assert "gpt-oss" not in result["warnings"][0]


def test_no_fallback_warning_when_preferred_model_answered():
    p = ScraperPipeline(api_key="test-key")
    p._brain = FakeBrain(['[{"name": "Item one"}]'])
    p._brain.preferred_model = p._brain.model_used = "openai/gpt-oss-120b"
    result = asyncio.run(p.run("https://example.com", "name (string)"))

    assert result["warnings"] == []


LONG_PAGE = "<main>" + "".join(f"<p>Item {i:02d} " + "y" * 990 + "</p>" for i in range(30)) + "</main>"


class RecordingBrain(FakeBrain):
    def __init__(self, replies):
        super().__init__(replies)
        self.calls = []

    async def extract(self, **kwargs):
        self.calls.append(kwargs)
        return self.replies.pop(0)


def run_long(monkeypatch, replies, expect_list=True):
    async def fetch(self, url, **_):
        return LONG_PAGE

    monkeypatch.setattr(FakeNavigator, "fetch", fetch)
    p = ScraperPipeline(api_key="test-key")
    p._brain = RecordingBrain(replies)
    events = []
    result = asyncio.run(
        p.run("https://example.com", "name (string)", expect_list=expect_list, on_event=events.append)
    )
    return result, events, p._brain.calls


def test_long_page_is_read_in_parts_and_merged(monkeypatch):
    result, events, calls = run_long(
        monkeypatch,
        [
            '[{"name": "Item 00"}, {"name": "Item 01"}]',
            '[{"name": "Item 01"}, {"name": "Item 02"}]',  # Item 01 again, from the overlap
            '[{"name": "Item 03"}]',
        ],
    )

    assert [c["part"] for c in calls] == [(1, 3), (2, 3), (3, 3)]
    assert all(len(c["cleaned_text"]) <= 15_000 for c in calls)
    assert result["data"] == [{"name": f"Item 0{i}"} for i in range(4)]
    assert result["warnings"] == []
    infer = [e for e in events if e.get("step") == "infer"]
    assert [(e["part"], e["parts"]) for e in infer] == [(1, 3), (2, 3), (3, 3)]
    assert [e["total_items"] for e in events if e["type"] == "part_done"] == [2, 3, 4]


def test_part_without_items_is_fine_and_ends_the_list(monkeypatch):
    result, events, calls = run_long(monkeypatch, ['[{"name": "Item 00"}]', "[]"])

    assert len(calls) == 2  # part 3 skipped: the list ended in part 2
    assert result["data"] == [{"name": "Item 00"}]
    assert [e["stopped"] for e in events if e["type"] == "part_done"] == [False, True]


def test_items_after_an_empty_first_part_are_found(monkeypatch):
    result, _, calls = run_long(monkeypatch, ["[]", '[{"name": "Item 12"}]', "[]"])

    assert len(calls) == 3
    assert result["data"] == [{"name": "Item 12"}]


def test_no_items_in_any_part_is_an_error(monkeypatch):
    with pytest.raises(RuntimeError, match="No items matching your fields"):
        run_long(monkeypatch, ["[]", "[]", "[]"])


def test_part_warnings_say_which_part(monkeypatch):
    result, _, _ = run_long(
        monkeypatch, ['[{"name": "Item 00"}]', '[{"name": "Item 10"}, {"name": "It', '[{"name": "Item 20"}]']
    )

    assert len(result["warnings"]) == 1
    assert result["warnings"][0].startswith("Part 2 of 3: The model's output hit its length limit")


def test_single_record_reads_only_the_first_part(monkeypatch):
    result, _, calls = run_long(monkeypatch, ['{"name": "Item 00"}'], expect_list=False)

    assert len(calls) == 1
    assert "part" not in calls[0]
    assert len(calls[0]["cleaned_text"]) == 12_000
    assert result["warnings"][0].startswith("Only the first 12,000")


def test_streams_a_screenshot_event_when_asked(monkeypatch):
    calls = []

    async def fetch(self, url, **kwargs):
        calls.append(kwargs)
        self.last_screenshot = {"jpeg": b"\xff\xd8jpeg", "width": 1920, "height": 1200}
        return PAGE

    monkeypatch.setattr(FakeNavigator, "fetch", fetch)
    p = ScraperPipeline(api_key="test-key")
    p._brain = FakeBrain(['[{"name": "Item one"}]'])
    events = []
    result = asyncio.run(p.run("https://example.com", "name (string)", on_event=events.append, screenshots=True))

    shots = [e for e in events if e["type"] == "screenshot"]
    assert calls[0]["screenshot"] is True
    assert len(shots) == 1
    assert shots[0]["page"] == 1 and shots[0]["width"] == 1920 and shots[0]["height"] == 1200
    assert shots[0]["image"].startswith("data:image/jpeg;base64,")
    assert "image" not in str(result)


def test_no_screenshot_by_default(monkeypatch):
    calls = []

    async def fetch(self, url, **kwargs):
        calls.append(kwargs)
        return PAGE

    monkeypatch.setattr(FakeNavigator, "fetch", fetch)
    p = ScraperPipeline(api_key="test-key")
    p._brain = FakeBrain(['[{"name": "Item one"}]'])
    events = []
    asyncio.run(p.run("https://example.com", "name (string)", on_event=events.append))

    assert calls[0]["screenshot"] is False
    assert not [e for e in events if e["type"] == "screenshot"]


def names(prefix, n):
    return json.dumps([{"name": f"{prefix}{i}"} for i in range(n)])


TWO_PAGES = {"https://site.test/1": page_html("one", "/2"), "https://site.test/2": page_html("two")}


def test_short_later_page_is_read_again_and_larger_result_kept(monkeypatch):
    result, _ = run_pages(monkeypatch, TWO_PAGES, [names("a", 20), names("b", 3), names("c", 18)], max_pages=2)

    assert result["items_count"] == 38
    assert result["data"][20:] == [{"name": f"c{i}"} for i in range(18)]
    assert result["warnings"] == []


def test_page_still_short_after_second_read_gets_a_note(monkeypatch):
    result, _ = run_pages(monkeypatch, TWO_PAGES, [names("a", 20), names("b", 3), names("c", 2)], max_pages=2)

    assert result["items_count"] == 23  # the first read (3) beats the second (2)
    assert len(result["warnings"]) == 1
    assert result["warnings"][0].startswith("Page 2: Only 3 records here, while earlier pages had 20")


def test_small_pages_are_not_reread(monkeypatch):
    # Earlier pages under SHORT_PAGE_MIN records: a short page is normal, no extra call.
    result, _ = run_pages(monkeypatch, TWO_PAGES, [names("a", 6), names("b", 1)], max_pages=2)

    assert result["items_count"] == 7
    assert result["warnings"] == []


def test_emits_highlight_boxes_for_located_records(monkeypatch):
    from tests.test_locate import BOOKS, card_page

    async def fetch(self, url, **kwargs):
        self.last_screenshot = {"jpeg": b"jpg", "width": 1000, "height": 1600, "layout": card_page(BOOKS)}
        return PAGE

    monkeypatch.setattr(FakeNavigator, "fetch", fetch)
    p = ScraperPipeline(api_key="test-key")
    p._brain = FakeBrain(['[{"title": "Tipping the Velvet", "price": 53.74}, {"title": "Missing", "price": 1.0}]'])
    events = []
    asyncio.run(p.run("https://example.com", "title (string), price (float)", on_event=events.append, screenshots=True))

    marks = [e for e in events if e["type"] == "highlights"]
    assert len(marks) == 1
    assert marks[0]["page"] == 1
    assert marks[0]["boxes"] == [{"i": 0, "x": 100, "y": 400, "w": 200, "h": 300}]


JOB_PAGE = "<main>" + "".join(
    f"<div><h3>{t}</h3><p>{c}</p><p>{y}</p><p>Bengaluru</p><p>Build and ship models for clients.</p></div>"
    for t, c, y in [("Associate AI/ML Engineer", "Optum", "3-8 Yrs"), ("HCL Weekend Drive", "HCLTech", "6-11 Yrs")]
    + [("AI / ML Engineer", "Accenture", f"{n}-{n + 3} Yrs") for n in range(2, 8)]
) + "<p>About us</p></main>"


def job(t, c, y):
    return {"title": t, "company": c, "experience": y, "location": "Bengaluru"}


def run_jobs(monkeypatch, replies):
    async def fetch(self, url, **_):
        return JOB_PAGE

    monkeypatch.setattr(FakeNavigator, "fetch", fetch)
    p = ScraperPipeline(api_key="test-key")
    p._brain = RecordingBrain(replies)
    result = asyncio.run(p.run("https://example.com", "title, company, experience, location"))
    return result, p._brain.calls


def test_items_after_where_the_model_stopped_are_read(monkeypatch):
    first = [job("Associate AI/ML Engineer", "Optum", "3-8 Yrs"), job("HCL Weekend Drive", "HCLTech", "6-11 Yrs"),
             job("AI / ML Engineer", "Accenture", "2-5 Yrs")]
    rest = [job("AI / ML Engineer", "Accenture", f"{n}-{n + 3} Yrs") for n in range(2, 8)]
    result, calls = run_jobs(monkeypatch, [json.dumps(first), json.dumps(rest)])

    assert len(calls) == 2
    assert calls[1]["cleaned_text"].startswith("AI / ML Engineer")
    assert result["items_count"] == 8  # the repeated 2-5 Yrs job is merged


def test_complete_page_is_read_once(monkeypatch):
    jobs = [job("Associate AI/ML Engineer", "Optum", "3-8 Yrs"), job("HCL Weekend Drive", "HCLTech", "6-11 Yrs")]
    jobs += [job("AI / ML Engineer", "Accenture", f"{n}-{n + 3} Yrs") for n in range(2, 8)]
    result, calls = run_jobs(monkeypatch, [json.dumps(jobs)])

    assert len(calls) == 1 and result["items_count"] == 8


def test_load_more_presses_are_passed_on_and_reported(monkeypatch):
    seen = {}

    async def fetch(self, url, load_more=0, **_):
        seen["load_more"] = load_more
        self.load_more_presses = 2
        return PAGE

    monkeypatch.setattr(FakeNavigator, "fetch", fetch)
    p = ScraperPipeline(api_key="test-key")
    p._brain = FakeBrain(['[{"name": "Item one"}]'])
    events = []
    asyncio.run(p.run("https://example.com", "name (string)", load_more=4, on_event=events.append))

    assert seen["load_more"] == 4
    assert {"type": "loaded_more", "page": 1, "presses": 2} in events
