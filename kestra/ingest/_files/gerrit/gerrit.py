"""Gerrit Account·Project·Group 전체를 스트림마다 JSONL로 받는다. 표준 라이브러리만 쓴다.
ADR: docs/adr/airbyte/0005 (IG1~IG7, IR3·IR4·IR7)

환경 변수
  GERRIT_URL             예) https://gerrit.example.com
  GERRIT_USERNAME_FILE   HTTP 계정 파일 경로(없으면 GERRIT_USERNAME 값)
  GERRIT_PASSWORD_FILE   HTTP 비밀번호 파일 경로(없으면 GERRIT_PASSWORD 값)
  GERRIT_PAGE_SIZE       페이지 크기(기본 100)

사용
  python gerrit.py --out-dir .      → account.jsonl, project.jsonl, group.jsonl

비밀값은 실행마다 파일에서 읽는다. 값은 로그·예외에 남기지 않는다(Kestra는 secret() 값만 마스킹한다).
"""

import argparse
import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Callable, Iterator

XSSI_PREFIX = ")]}'"
ACCOUNT_QUERY = "is:active OR is:inactive"
TIMEOUT_SECONDS = 30  # IG6
STREAMS = ("account", "project", "group")

Fetch = Callable[[str, str], str]  # (path, query string) -> 응답 본문


def read_secret(name: str) -> str:
    """`<name>_FILE` 경로가 있으면 그 파일을, 없으면 `<name>` 환경 변수를 읽는다."""
    path = os.environ.get(f"{name}_FILE")
    if path:
        value = Path(path).read_text(encoding="utf-8").strip()
    else:
        value = os.environ.get(name, "")
    if not value:
        raise KeyError(f"secret not found: {name}")  # 값은 메시지에 넣지 않는다
    return value


def parse_gerrit_json(text: str, expected: type):
    """XSSI 접두사 한 줄을 지우고 JSON으로 읽는다. 기대한 형태(list 또는 dict)가 아니면 실패한다(IG2)."""
    if text.startswith(XSSI_PREFIX):
        text = text.split("\n", 1)[1] if "\n" in text else ""
    data = json.loads(text) if text.strip() else expected()
    if not isinstance(data, expected):
        raise ValueError(f"expected JSON {expected.__name__}, got {type(data).__name__}")
    return data


def make_fetcher(base_url: str, username: str, password: str) -> Fetch:
    token = base64.b64encode(f"{username}:{password}".encode()).decode()
    base = base_url.rstrip("/")

    def fetch(path: str, query: str) -> str:
        req = urllib.request.Request(f"{base}{path}?{query}", headers={"Authorization": f"Basic {token}"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:  # 4xx·5xx는 HTTPError로 실패
            return resp.read().decode("utf-8")

    return fetch


def _account_query(n: int, start: int) -> str:
    return urllib.parse.urlencode({"q": ACCOUNT_QUERY, "o": "DETAILS", "n": n, "S": start})


def _project_query(n: int, start: int) -> str:
    return f"d&all&n={n}&S={start}"  # d: 설명, all: HIDDEN 포함(값 없는 옵션)


def _group_query(n: int, start: int) -> str:
    return urllib.parse.urlencode([("o", "MEMBERS"), ("o", "INCLUDES"), ("n", n), ("S", start)])


def iter_accounts(fetch: Fetch, page_size: int) -> Iterator[dict]:
    """배열 응답. 마지막 레코드의 `_more_accounts`가 참이면 다음 페이지(IG3)."""
    start, seen = 0, set()
    while True:
        page = parse_gerrit_json(fetch("/a/accounts/", _account_query(page_size, start)), list)
        if not page:
            return
        more = bool(page[-1].get("_more_accounts"))
        for record in page:
            record.pop("_more_accounts", None)
            if record.get("_account_id") not in seen:
                seen.add(record.get("_account_id"))
                yield record
        if not more:
            return
        start += len(page)


def _iter_map(fetch: Fetch, path: str, query: Callable[[int, int], str], page_size: int,
              more_flag: str | None) -> Iterator[dict]:
    """이름을 키로 한 맵 응답. 키를 `name`으로 옮기고(IG4), 페이지 경계 중복은 한 번만 낸다(IG7).
    끝 판정: more_flag가 있으면 마지막 항목의 그 값, 없으면 받은 건수 < page_size(IG3)."""
    start, seen = 0, set()
    while True:
        page = parse_gerrit_json(fetch(path, query(page_size, start)), dict)
        if not page:
            return
        values = list(page.values())
        more = bool(values[-1].get(more_flag)) if more_flag else len(page) >= page_size
        for name, value in page.items():
            if more_flag:
                value.pop(more_flag, None)
            if name in seen:
                continue
            seen.add(name)
            yield {"name": name, **value} if "name" not in value else value
        if not more:
            return
        start += len(page)


def iter_projects(fetch: Fetch, page_size: int) -> Iterator[dict]:
    return _iter_map(fetch, "/a/projects/", _project_query, page_size, "_more_projects")


def iter_groups(fetch: Fetch, page_size: int) -> Iterator[dict]:
    return _iter_map(fetch, "/a/groups/", _group_query, page_size, None)


ITERATORS = {"account": iter_accounts, "project": iter_projects, "group": iter_groups}


def main(argv: list | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", default=".")
    args = parser.parse_args(argv)

    fetch = make_fetcher(os.environ["GERRIT_URL"], read_secret("GERRIT_USERNAME"), read_secret("GERRIT_PASSWORD"))
    page_size = int(os.environ.get("GERRIT_PAGE_SIZE") or "100")
    out_dir = Path(args.out_dir)

    counts = {}
    for stream in STREAMS:  # 세 스트림을 모두 받은 뒤에 Kestra가 올린다(IR9)
        with open(out_dir / f"{stream}.jsonl", "w", encoding="utf-8") as out:
            counts[stream] = 0
            for record in ITERATORS[stream](fetch, page_size):
                out.write(json.dumps(record, ensure_ascii=False) + "\n")
                counts[stream] += 1

    print("::" + json.dumps({"outputs": counts}) + "::")  # Kestra 스크립트 출력값
    empty = [s for s, c in counts.items() if c == 0]
    if empty:
        print(f"no records: {', '.join(empty)}", file=sys.stderr)  # IG5
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
