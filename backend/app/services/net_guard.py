"""
Worth the Watch? — Outbound URL guard for the article scraper.

The scraper fetches URLs that come from search results, so the target, and every
redirect it issues, is chosen by whoever runs that site. Following them blindly lets a
page bounce the backend onto 127.0.0.1, the cloud metadata address (169.254.169.254) or
anything else on the private network.

safe_get resolves the host of the first URL and of every redirect hop, refuses any
address that is not globally routable, and follows redirects by hand up to a fixed limit.

Residual risk: the address is checked and then httpx resolves the name again to connect,
so a DNS answer that changes between the two lookups (rebinding) is not caught here.
"""

import asyncio
import ipaddress
import socket
from urllib.parse import urlsplit

import httpx

MAX_REDIRECTS = 5
_REDIRECT_CODES = {301, 302, 303, 307, 308}


class UnsafeURLError(Exception):
    """The URL, or a redirect it issued, points somewhere the scraper must not go."""


def _is_public(ip: ipaddress._BaseAddress) -> bool:
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


async def _resolve(host: str, port: int) -> list[str]:
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return [info[4][0] for info in infos]


async def assert_public_url(url: str) -> None:
    """Raise UnsafeURLError unless url is http(s) and every address it resolves to is public."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise UnsafeURLError(f"unsupported URL: {url[:80]}")

    host = parts.hostname
    try:
        port = parts.port or (443 if parts.scheme == "https" else 80)
    except ValueError:
        raise UnsafeURLError(f"bad port in URL: {url[:80]}")

    try:
        addresses = [ipaddress.ip_address(host)]
    except ValueError:
        try:
            resolved = await _resolve(host, port)
        except (OSError, UnicodeError) as e:
            raise UnsafeURLError(f"cannot resolve {host}: {e}")
        # Drop any IPv6 zone id ("fe80::1%eth0") before parsing.
        addresses = [ipaddress.ip_address(a.split("%", 1)[0]) for a in resolved]

    if not addresses:
        raise UnsafeURLError(f"{host} resolved to no addresses")
    for ip in addresses:
        if not _is_public(ip):
            raise UnsafeURLError(f"{host} resolves to non-public address {ip}")


async def safe_get(client: httpx.AsyncClient, url: str, max_redirects: int = MAX_REDIRECTS) -> httpx.Response:
    """GET with every hop validated. The client must be created with follow_redirects=False."""
    for _ in range(max_redirects + 1):
        await assert_public_url(url)
        resp = await client.get(url)
        location = resp.headers.get("location")
        if resp.status_code in _REDIRECT_CODES and location:
            url = str(resp.url.join(location))
            continue
        return resp
    raise UnsafeURLError(f"more than {max_redirects} redirects")
