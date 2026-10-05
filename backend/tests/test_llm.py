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


async def test_truncated_json_is_repaired_once(fake_llm):
    from app.services.llm import synthesize_review

    script, calls = fake_llm
    truncated = json.dumps(VALID)[:60]
    script.extend([truncated, json.dumps(VALID)])

    out = await synthesize_review(**_kwargs())
    assert out.degraded is False
    assert out.review_text.startswith("The Matrix holds up")
    assert len(calls) == 2
    assert "not one valid JSON object" in calls[1]
    assert truncated in calls[1]


async def test_failed_repair_falls_back_to_a_degraded_placeholder(fake_llm):
    from app.services.llm import synthesize_review

    script, calls = fake_llm
    script.extend(['{"review_text": "cut off', "still not json"])

    out = await synthesize_review(**_kwargs())
    assert out.degraded is True
    assert "cut off" not in out.review_text
    assert len(calls) == 2  # one generation, one repair, nothing more


async def test_token_cap_is_1500():
    from app.services import llm

    seen = {}

    class FakeCompletions:
        async def create(self, **kwargs):
            seen.update(kwargs)
            msg = type("M", (), {"content": "{}"})()
            return type("R", (), {"choices": [type("C", (), {"message": msg})()]})()

    client = type("Client", (), {"chat": type("Chat", (), {"completions": FakeCompletions()})()})()
    await llm._call_llm(client, "model", "prompt")
    assert seen["max_tokens"] == 1500


@pytest.mark.parametrize("text,title,names,expected", [
    ("The Matrix still holds up.", "The Matrix", [], True),
    ("Dead Reckoning is a blast.", "Mission: Impossible - Dead Reckoning", [], True),
    ("The Last Jedi divides fans.", "Star Wars: The Last Jedi", [], True),
    ("Pure filler about nothing.", "Star Wars: The Last Jedi", [], False),
    ("Amelie charms everyone.", "Amélie", [], True),
    ("Reeves is magnetic here.", "The Matrix", ["Keanu Reeves"], True),
    ("Lana Wachowski directs with flair.", "The Matrix", ["Lana Wachowski"], True),
    ("A fun ride with great action.", "The Matrix", ["Keanu Reeves"], False),
    ("A fun ride.", "千と千尋の神隠し", [], True),  # nothing matchable in Latin script
])
def test_review_mentions_subject(text, title, names, expected):
    from app.services.llm import review_mentions_subject

    assert review_mentions_subject(text, title, names) is expected
