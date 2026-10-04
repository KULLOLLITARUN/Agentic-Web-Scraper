import asyncio
from types import SimpleNamespace

import groq
import httpx
import pytest

from scraper import brain as brain_module
from scraper.brain import MODELS, Brain


def api_error(cls, status, code=None):
    request = httpx.Request("POST", "https://api.groq.com/openai/v1/chat/completions")
    response = httpx.Response(status, request=request)
    body = {"error": {"message": "boom", "code": code}} if code else None
    return cls("boom", response=response, body=body)


def reply(text, finish_reason="stop"):
    choice = SimpleNamespace(message=SimpleNamespace(content=text), finish_reason=finish_reason)
    return SimpleNamespace(choices=[choice])


class FakeCompletions:
    """Plays back one outcome per call (an exception to raise, or reply text)."""

    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.models = []

    async def create(self, model, **_):
        self.models.append(model)
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        if isinstance(outcome, tuple):
            return reply(*outcome)
        return reply(outcome)


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    async def instant(_):
        return None

    monkeypatch.setattr(brain_module.asyncio, "sleep", instant)


def make_brain(outcomes, **kwargs):
    b = Brain(api_key="test-key", **kwargs)
    fake = FakeCompletions(outcomes)
    b._client = SimpleNamespace(chat=SimpleNamespace(completions=fake))
    return b, fake


def extract(b):
    return asyncio.run(b.extract(cleaned_text="page text", schema_description="title (string)"))


def test_default_model_order():
    assert Brain(api_key="k")._models == MODELS


def test_preferred_model_goes_first_without_duplicates():
    b = Brain(api_key="k", model=MODELS[-1])
    assert b._models[0] == MODELS[-1]
    assert sorted(b._models) == sorted(MODELS)


def test_missing_api_key_raises(monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    with pytest.raises(ValueError, match="GROQ_API_KEY"):
        Brain()


def test_prompt_has_no_item_cap():
    b, fake = make_brain(["[]"])
    captured = {}
    original = fake.create

    async def spy(**kw):
        captured.update(kw)
        return await original(**kw)

    fake.create = spy
    extract(b)

    prompt = captured["messages"][1]["content"]
    assert "EVERY matching item" in prompt
    assert "up to 15" not in prompt
    # Without this, gpt-oss skipped look-alike job listings (5-22 of 22 found).
    assert "look alike" in prompt


@pytest.mark.parametrize(
    "error",
    [
        api_error(groq.RateLimitError, 429),
        api_error(groq.InternalServerError, 503),
        api_error(groq.APIStatusError, 413),
        api_error(groq.NotFoundError, 404, code="model_not_found"),
        api_error(groq.BadRequestError, 400, code="model_decommissioned"),
    ],
)
def test_fails_over_on_model_specific_errors(error):
    b, fake = make_brain([error, '[{"title": "ok"}]'])

    assert extract(b) == '[{"title": "ok"}]'
    assert fake.models == MODELS[:2]


@pytest.mark.parametrize(
    "error",
    [
        api_error(groq.AuthenticationError, 401),
        api_error(groq.PermissionDeniedError, 403),
        api_error(groq.BadRequestError, 400, code="invalid_request"),
    ],
)
def test_raises_immediately_on_errors_every_model_would_hit(error):
    b, fake = make_brain([error, '[{"title": "unreached"}]'])

    with pytest.raises(type(error)):
        extract(b)
    assert fake.models == MODELS[:1]


def test_empty_reply_fails_over():
    b, fake = make_brain(["", '[{"title": "ok"}]'])

    assert extract(b) == '[{"title": "ok"}]'
    assert fake.models == MODELS[:2]


def test_raises_last_error_when_every_model_fails():
    errors = [api_error(groq.RateLimitError, 429) for _ in MODELS]
    b, _ = make_brain(errors)

    with pytest.raises(groq.RateLimitError):
        extract(b)


@pytest.mark.parametrize(
    "model, expected",
    [
        ("openai/gpt-oss-120b", {"reasoning_effort": "low"}),
        ("openai/gpt-oss-20b", {"reasoning_effort": "low"}),
        ("qwen/qwen3.8-27b", {}),
    ],
)
def test_reasoning_effort_only_sent_to_gpt_oss(model, expected):
    b, fake = make_brain(["[]"], model=model)
    captured = {}
    original = fake.create

    async def spy(**kw):
        captured.update(kw)
        return await original(**kw)

    fake.create = spy
    extract(b)

    assert {k: v for k, v in captured.items() if k == "reasoning_effort"} == expected


@pytest.mark.parametrize(
    "model, budget",
    [("openai/gpt-oss-120b", brain_module.GPT_OSS_TOKEN_BUDGET), ("qwen/qwen3.8-27b", 800)],
)
def test_token_budget_per_model(model, budget):
    b, fake = make_brain(["[]"], model=model)
    captured = {}
    original = fake.create

    async def spy(**kw):
        captured.update(kw)
        return await original(**kw)

    fake.create = spy
    extract(b)

    assert captured["max_tokens"] == budget


def test_token_budget_shrinks_so_prompt_plus_output_fits_tpm():
    from scraper.brain import CHARS_PER_TOKEN, MIN_TOKEN_BUDGET, TPM_LIMIT, _token_budget

    short = _token_budget("openai/gpt-oss-120b", 3_000)
    page = _token_budget("openai/gpt-oss-120b", 14_500)  # 12k-char page + prompt text
    huge = _token_budget("openai/gpt-oss-120b", 100_000)

    assert short == brain_module.GPT_OSS_TOKEN_BUDGET
    assert 3_000 < page < 4_000
    assert 14_500 / CHARS_PER_TOKEN + page <= TPM_LIMIT
    assert huge == MIN_TOKEN_BUDGET


def test_truncated_set_when_reply_hits_length_limit():
    b, _ = make_brain([('[{"title": "a"}, {"ti', "length"), "[]"])

    extract(b)
    assert b.truncated is True

    extract(b)
    assert b.truncated is False


def test_model_used_records_which_model_answered():
    b, _ = make_brain([api_error(groq.RateLimitError, 429), "[]"])

    extract(b)

    assert b.preferred_model == MODELS[0]
    assert b.model_used == MODELS[1]


def test_prompt_says_which_part_of_a_long_page():
    b, fake = make_brain(["[]", "[]"])
    prompts = []
    original = fake.create

    async def spy(**kw):
        prompts.append(kw["messages"][1]["content"])
        return await original(**kw)

    fake.create = spy
    asyncio.run(b.extract(cleaned_text="t", schema_description="title (string)", part=(2, 3)))
    extract(b)

    assert "part 2 of 3" in prompts[0]
    assert "part " not in prompts[1].lower().split("## website text")[1]


def budgets_spy(fake):
    budgets = []
    original = fake.create

    async def spy(**kw):
        budgets.append((kw["model"], kw["max_tokens"]))
        return await original(**kw)

    fake.create = spy
    return budgets


def test_tpm_413_retries_same_model_with_smaller_budget():
    too_large = api_error(groq.APIStatusError, 413, code="rate_limit_exceeded")
    b, fake = make_brain([too_large, "[]"])
    budgets = budgets_spy(fake)

    assert extract(b) == "[]"
    (m1, first), (m2, second) = budgets
    assert m1 == m2 == MODELS[0]
    assert second < first
    assert b.model_used == MODELS[0]


def test_second_tpm_413_fails_over():
    too_large = api_error(groq.APIStatusError, 413, code="rate_limit_exceeded")
    b, fake = make_brain([too_large, too_large, "[]"])
    budgets = budgets_spy(fake)

    extract(b)

    assert [m for m, _ in budgets] == [MODELS[0], MODELS[0], MODELS[1]]
    assert b.model_used == MODELS[1]
