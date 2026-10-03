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


def reply(text):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=text))])


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
