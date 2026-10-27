"""
Worth the Watch? — Database Connection
Async SQLAlchemy 2.0 with Neon PostgreSQL.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.config import get_settings

settings = get_settings()

# DO NOT reintroduce connection pooling here.
#
# Neon only autosuspends its compute when nothing is connected. A pool keeps
# sockets open between requests, and nothing reaps an idle one — pool_recycle
# only discards a stale connection on the NEXT checkout, so a quiet backend
# still holds its connections open indefinitely. Combined with the uptime cron
# that keeps this process alive around the clock, that meant the compute never
# suspended and ran 24/7: roughly 6 CU-hours a day, which exhausted a 100
# CU-hour month in about sixteen days. It did so twice.
#
# NullPool closes the connection as soon as the request finishes, which gives
# Neon the idle window it needs. The cost is a fresh connect per DB-touching
# request, which is immaterial at this traffic and is paid mostly by background
# ISR revalidation that no user waits on.
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool,
    # Fail fast instead of hanging if Neon is throttled or waking.
    connect_args={"timeout": 10},
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db():
    """Dependency: yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Create all tables. Called on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
