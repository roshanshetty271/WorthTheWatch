"""
Worth the Watch? — Database Connection
Async SQLAlchemy 2.0 with Neon PostgreSQL.
"""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    # Small pool: a single Koyeb instance can't usefully hold many sockets, and
    # fewer lingering connections lets Neon's serverless compute scale to zero.
    pool_size=2,
    max_overflow=3,
    # Keep pre_ping: after Neon autosuspends and drops the socket, the next
    # checkout transparently reconnects (waking Neon) instead of erroring.
    pool_pre_ping=True,
    # Recycle connections every 5 min so they don't pin the compute awake.
    pool_recycle=300,
    # Fail fast instead of hanging if the DB is throttled/unavailable.
    pool_timeout=10,
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
