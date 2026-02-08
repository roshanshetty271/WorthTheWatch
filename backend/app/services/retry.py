"""
Worth the Watch? — Retry Utility
Provides async retry decorator with exponential backoff and timeout.
"""

import asyncio
import logging
from functools import wraps
from typing import Callable, TypeVar, Any
import httpx

logger = logging.getLogger(__name__)

T = TypeVar("T")


class RetryExhausted(Exception):
    """All retry attempts failed."""
    pass


def with_retry(
    max_retries: int = 2,
    base_delay: float = 1.0,
    max_delay: float = 5.0,
    timeout: float = 10.0,
    exceptions: tuple = (httpx.HTTPError, httpx.TimeoutException, asyncio.TimeoutError),
):
    """
    Async retry decorator with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts (not including first try)
        base_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries
        timeout: Total timeout for each attempt
        exceptions: Tuple of exceptions to catch and retry on
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    # Wrap the call with a timeout
                    return await asyncio.wait_for(
                        func(*args, **kwargs),
                        timeout=timeout
                    )
                except exceptions as e:
                    last_exception = e
                    
                    if attempt < max_retries:
                        # Calculate delay with exponential backoff
                        delay = min(base_delay * (2 ** attempt), max_delay)
                        logger.warning(
                            f"Retry {attempt + 1}/{max_retries} for {func.__name__} "
                            f"after {e.__class__.__name__}. Waiting {delay}s..."
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"All {max_retries + 1} attempts failed for {func.__name__}: {e}"
                        )
            
            # All retries exhausted
            raise RetryExhausted(
                f"Operation failed after {max_retries + 1} attempts: {last_exception}"
            ) from last_exception
        
        return wrapper
    return decorator
