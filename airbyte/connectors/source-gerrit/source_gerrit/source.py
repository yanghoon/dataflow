import json
import logging
import time
from typing import Any, Iterable, Mapping, Optional, Tuple
from urllib.parse import parse_qs, urlparse

import requests
from airbyte_cdk.sources import AbstractSource
from airbyte_cdk.sources.streams.http import HttpStream
from airbyte_cdk.sources.streams.http.requests_native_auth import BasicHttpAuthenticator

logger = logging.getLogger("airbyte")

_orig_send = requests.Session.send


def _sanitize_headers(headers: Mapping[str, Any]) -> dict:
    sanitized = {}
    for k, v in headers.items():
        if k.lower() in ("authorization", "proxy-authorization", "cookie", "set-cookie"):
            sanitized[k] = "***MASKED***"
        else:
            sanitized[k] = v
    return sanitized


def _logged_send(self, request, **kwargs):
    start = time.time()
    safe_headers = _sanitize_headers(getattr(request, "headers", {}) or {})
    logger.info(f"[HTTP REQUEST] {request.method} {request.url} | Headers: {safe_headers}")
    try:
        resp = _orig_send(self, request, **kwargs)
    except Exception as e:
        logger.error(f"[HTTP FAILED] {request.method} {request.url} FAILED {type(e).__name__}: {e}")
        raise
    elapsed = time.time() - start
    size = resp.headers.get("Content-Length", "?")
    content_type = resp.headers.get("Content-Type", "unknown")
    logger.info(
        f"[HTTP RESPONSE] {request.method} {request.url} -> {resp.status_code} "
        f"({elapsed:.3f}s, size={size}, type={content_type})"
    )
    if resp.status_code >= 400:
        logger.error(f"[HTTP ERROR BODY] status={resp.status_code} url={request.url} body: {resp.text[:500]!r}")
    return resp


requests.Session.send = _logged_send


def load_gerrit_json(response: requests.Response):
    text = response.text
    if text.startswith(")]}'"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
    try:
        return json.loads(text) if text.strip() else []
    except json.JSONDecodeError:
        url = response.request.url if response.request else ""
        logger.error(f"[PARSE] JSON Decode Error url={url} status={response.status_code}")
        return []


class GerritStream(HttpStream):
    """Shared Gerrit list stream: auth, XSSI strip, `n`/`S` offset paging.

    A subclass declares `path`, `fixed_params`, `primary_key`, `map_response`
    and `more_marker`. The schema is `schemas/<name>.json`.
    """

    map_response: bool = False  # True: response is a map keyed by name; key moves to `name`
    more_marker: str = ""       # e.g. "_more_accounts": set on the last record when more pages exist

    def __init__(self, config: Mapping[str, Any], **kwargs):
        super().__init__(
            authenticator=BasicHttpAuthenticator(
                username=config["username"], password=config["password"]
            )
        )
        self._url_base = config["gerrit_url"].rstrip("/") + "/"
        self.page_size = int(config.get("page_size", 100))
        self.debug_records = bool(config.get("debug_records", False))

    @property
    def url_base(self) -> str:
        return self._url_base

    def fixed_params(self) -> Mapping[str, Any]:
        return {}

    def request_params(self, stream_state=None, stream_slice=None, next_page_token=None):
        params = {**self.fixed_params(), "n": self.page_size}
        if next_page_token:
            params.update(next_page_token)
        return params

    def _page_records(self, response: requests.Response) -> list:
        data = load_gerrit_json(response)
        if self.map_response:
            if isinstance(data, dict) and all(isinstance(v, dict) for v in data.values()):
                return [{"name": key, **value} for key, value in data.items()]
        elif isinstance(data, list):
            return data
        logger.warning(f"[PARSE] {self.name}: unexpected response {type(data).__name__}: {data!r}"[:500])
        return []

    def is_last_page(self, records: list) -> bool:
        return not records or not records[-1].get(self.more_marker)

    def next_page_token(self, response: requests.Response) -> Optional[Mapping[str, Any]]:
        records = self._page_records(response)
        if self.is_last_page(records):
            logger.info(f"[PAGE] {self.name}: last page reached. Total on page: {len(records)}")
            return None
        url = response.request.url if response.request else ""
        start = int(parse_qs(urlparse(url).query).get("S", ["0"])[0])
        next_start = start + len(records)
        logger.info(
            f"[PAGE] {self.name}: {self.more_marker}=True, batch_count={len(records)}, "
            f"advancing offset from S={start} to S={next_start}"
        )
        return {"S": next_start}

    def parse_response(self, response: requests.Response, **kwargs) -> Iterable[Mapping]:
        records = self._page_records(response)
        for i, rec in enumerate(records, start=1):
            rec.pop(self.more_marker, None)
            if self.debug_records:
                logger.info(f"[RECORD #{i}] {json.dumps(rec, ensure_ascii=False)}")
            yield rec
        logger.info(f"[PARSE] {self.name}: yielded {len(records)} records")


class Accounts(GerritStream):
    primary_key = "_account_id"
    more_marker = "_more_accounts"

    def path(self, **kwargs) -> str:
        return "a/accounts/"

    def fixed_params(self) -> Mapping[str, Any]:
        return {"q": "is:active OR is:inactive", "o": "DETAILS"}


class Projects(GerritStream):
    primary_key = "id"
    map_response = True
    more_marker = "_more_projects"

    def path(self, **kwargs) -> str:
        # `d` (description) and `all` (include HIDDEN) are valueless options, so they live in the path.
        return "a/projects/?d&all"


class SourceGerrit(AbstractSource):
    def check_connection(self, logger, config) -> Tuple[bool, Any]:
        url = config["gerrit_url"].rstrip("/") + "/a/accounts/self"
        username = config.get("username", "")
        logger.info(f"[CHECK] Attempting connection check to {url} (user: {username})")
        try:
            res = requests.get(url, auth=(config["username"], config["password"]), timeout=30)
            res.raise_for_status()
            logger.info(f"[CHECK] Connection check SUCCEEDED (status={res.status_code})")
            return True, None
        except Exception as e:
            logger.error(f"[CHECK] Connection check FAILED for {url}: {e}")
            return False, str(e)

    def streams(self, config: Mapping[str, Any]):
        return [Accounts(config), Projects(config)]
