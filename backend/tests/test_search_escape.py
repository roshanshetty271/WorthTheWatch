"""Search treats %, _ and backslash in the query literally."""
import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from conftest import requires_db

TITLES = ["100% Wolf", "Wolf Creek", "A_B Story", "AxB Story", r"Back\Slash", "Plain"]


def test_wildcards_are_escaped_in_the_sql():
    from app.routers.search import _title_contains

    compiled = _title_contains("50%_off\\").compile(dialect=postgresql.dialect())
    assert "ESCAPE" in str(compiled)
    assert list(compiled.params.values()) == [r"%50\%\_off\\%"]


@requires_db
@pytest.mark.parametrize("query,expected", [
    ("%", ["100% Wolf"]),
    ("_", ["A_B Story"]),
    ("A_B", ["A_B Story"]),
    ("\\", [r"Back\Slash"]),
    ("wolf", ["100% Wolf", "Wolf Creek"]),
])
async def test_search_matches_the_query_literally(db_schema, query, expected):
    from app.database import async_session
    from app.models import Movie
    from app.routers.search import _title_contains

    async with async_session() as db:
        for i, t in enumerate(TITLES):
            db.add(Movie(tmdb_id=i + 1, title=t, media_type="movie"))
        await db.commit()
        rows = (await db.execute(
            select(Movie.title).where(_title_contains(query)).order_by(Movie.title)
        )).scalars().all()
    assert rows == sorted(expected)
