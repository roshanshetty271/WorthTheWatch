"""synthesize_review with the model client faked. No network."""
import json

import pytest

VALID = {
    "review_text": "The Matrix holds up. Keanu Reeves is perfectly cast.",
    "verdict": "WORTH IT",
    "praise_points": ["Action"],
    "criticism_points": [],
    "confidence": "HIGH",
}


def _kwargs(**over):
    base = dict(title="The Matrix", year="1999", genres="Action", overview="",
                opinions="[Source: example.com]\nGreat.", sources_count=1)
    base.update(over)
    return base


@pytest.fixture
def fake_llm(monkeypatch):
    """Replace _call_llm with a scripted sequence of replies (str) or failures (Exception)."""
    from app.services import llm

    calls = []
    script = []

    async def fake_call(client, model, user_prompt):
        calls.append(user_prompt)
        reply = script.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply

    monkeypatch.setattr(llm, "_call_llm", fake_call)
    return script, calls


async def test_every_model_call_failing_returns_a_degraded_placeholder(fake_llm):
    from app.services.llm import synthesize_review

    script, _ = fake_llm
    script.extend([RuntimeError("down")] * 3)

    out = await synthesize_review(**_kwargs())
    assert out.degraded is True


async def test_a_normal_reply_is_not_degraded(fake_llm):
    from app.services.llm import synthesize_review

    script, _ = fake_llm
    script.append(json.dumps(VALID))

    out = await synthesize_review(**_kwargs())
    assert out.degraded is False
    assert out.verdict == "WORTH IT"
