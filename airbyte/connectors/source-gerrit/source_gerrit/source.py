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
    def __init__(self, config: Mapping[str, Any], **kwargs):
        super().__init__(
            authenticator=BasicHttpAuthenticator(
                username=config["username"], password=config["password"]
            )
        )
        self._url_base = config["gerrit_url"].rstrip("/") + "/"

    @property
    def url_base(self) -> str:
        return self._url_base

    def get_json_schema(self) -> Mapping[str, Any]:
        return {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {},
            "additionalProperties": True,
        }

    def next_page_token(self, response: requests.Response) -> Optional[Mapping[str, Any]]:
        return None


class Accounts(GerritStream):
    primary_key = "_account_id"

    def __init__(self, config: Mapping[str, Any], **kwargs):
        super().__init__(config, **kwargs)
        self.page_size = int(config.get("page_size", 100))
        self.debug_records = bool(config.get("debug_records", False))

    def path(self, **kwargs) -> str:
        return "a/accounts/"

    def request_params(self, stream_state=None, stream_slice=None, next_page_token=None):
        params = {"q": "is:active OR is:inactive", "o": "DETAILS", "n": self.page_size}
        if next_page_token:
            params.update(next_page_token)
        return params

    def next_page_token(self, response: requests.Response) -> Optional[Mapping[str, Any]]:
        data = load_gerrit_json(response)
        if isinstance(data, list) and data:
            has_more = bool(data[-1].get("_more_accounts"))
            if has_more:
                url = response.request.url if response.request else ""
                qs = parse_qs(urlparse(url).query)
                start = int(qs.get("S", ["0"])[0])
                next_start = start + len(data)
                logger.info(
                    f"[PAGE] _more_accounts=True detected: batch_count={len(data)}, "
                    f"advancing offset from S={start} to S={next_start}"
                )
                return {"S": next_start}
            else:
                logger.info(f"[PAGE] Last page reached (_more_accounts=False). Total on page: {len(data)}")
                return None
        logger.info("[PAGE] Empty or non-list response; ending pagination.")
        return None

    def parse_response(self, response: requests.Response, **kwargs) -> Iterable[Mapping]:
        records = load_gerrit_json(response)
        if isinstance(records, list):
            raw_count = len(records)
            yielded_count = 0
            for rec in records:
                rec.pop("_more_accounts", None)
                if self.debug_records:
                    logger.info(f"[RECORD #{yielded_count + 1}] {json.dumps(rec, ensure_ascii=False)}")
                yielded_count += 1
                yield rec
            logger.info(f"[PARSE] Extracted and yielded {yielded_count}/{raw_count} clean account records")
        else:
            logger.warning(f"[PARSE] Expected list of records but got {type(records).__name__}: {records!r}")


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
        return [Accounts(config)]
