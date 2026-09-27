"""Test env. Settings are read at import time, so these must be set before app.* imports."""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://u:p@localhost/test")
os.environ.setdefault("CRON_SECRET", "test-cron-secret")
os.environ.setdefault("IP_HASH_SALT", "test-salt")
os.environ.setdefault("INTERNAL_PROXY_SECRET", "test-proxy-secret")
