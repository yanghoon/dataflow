"""Gerrit · GHES 목 서버(표준 라이브러리만). ADR: docs/adr/airbyte/0005 "Gerrit REST 사실", "목 서버"

  python server.py gerrit [port]
    GET /a/accounts/?q=&o=DETAILS&n=&S=   배열, 마지막 레코드 _more_accounts
    GET /a/projects/?d&all&n=&S=          이름 키 맵, 마지막 항목 _more_projects. all 없으면 HIDDEN 제외, d 없으면 description 없음
    GET /a/groups/?o=MEMBERS&o=INCLUDES&n=&S=   이름 키 맵(값에 name 없음), 끝 표시 없음. o 없으면 members·includes 없음
    모두 )]}' 접두사, Basic 인증
  python server.py ghes [port]
    GET /stafftools/reports/active_users.csv   Bearer 인증. 생성 중 응답 N번 뒤 CSV

환경 변수
  MOCK_SECRETS_DIR        자격 증명 파일 디렉터리(기본 /run/secrets): GERRIT_USERNAME, GERRIT_PASSWORD, GHES_PAT
  MOCK_GERRIT_ACCOUNTS    계정 수(기본 250)
  MOCK_GERRIT_PROJECTS    프로젝트 수(기본 250, 10번째마다 HIDDEN)
  MOCK_GERRIT_GROUPS      그룹 수(기본 200 = 페이지 100의 배수)
  MOCK_GERRIT_DUP         1이면 맵 페이지마다 앞 페이지 마지막 항목을 다시 준다(페이지 경계 중복)
  MOCK_FAIL_FIRST         처음 N번 요청에 503(재시도 시험)
  MOCK_GHES_PENDING       CSV 전 생성 중 응답 수(기본 2). CSV를 준 뒤 다시 센다
  MOCK_GHES_MODE          생성 중 응답: 202(기본) | empty(200 + 빈 본문)
"""

import base64
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

CSV = ("created_at,id,login,email\n"
       "2024-01-01 00:00:00 UTC,1,alice,alice@example.com\n"
       "2024-01-02 00:00:00 UTC,2,bob,bob@example.com\n")
XSSI = ")]}'\n"
_lock = threading.Lock()
_state = {"requests": 0, "ghes_pending": 0}


def env_int(name: str, default: int) -> int:
    return int(os.environ.get(name, str(default)))


def secret(name: str) -> str:
    return (Path(os.environ.get("MOCK_SECRETS_DIR", "/run/secrets")) / name).read_text().strip()


def account(i: int, details: bool) -> dict:
    a = {"_account_id": i}
    if details:
        a.update(name=f"User {i}", display_name=f"user{i}", email=f"user{i}@example.com", username=f"user{i}")
        if i % 25 == 0:
            a["inactive"] = True
    return a


def projects(include_hidden: bool, description: bool) -> list:
    out = []
    for i in range(1, env_int("MOCK_GERRIT_PROJECTS", 250) + 1):
        name, hidden = f"team/project-{i:04d}", i % 10 == 0
        if hidden and not include_hidden:
            continue
        v = {"id": quote(name, safe=""), "parent": "All-Projects", "state": "HIDDEN" if hidden else "ACTIVE"}
        if description:
            v["description"] = f"Project {i}"
        out.append((name, v))
    return out


def groups(members: bool, includes: bool) -> list:
    out = []
    for i in range(1, env_int("MOCK_GERRIT_GROUPS", 200) + 1):
        v = {"id": f"{i:040x}", "group_id": i, "owner": "Administrators", "owner_id": f"{0:040x}",
             "options": {"visible_to_all": True} if i % 2 == 0 else {},
             "created_on": "2024-01-01 00:00:00.000000000"}
        if members:
            v["members"] = [account(i, True), account(i + 1, True)]
        if includes and i > 1:
            v["includes"] = [{"id": f"{i - 1:040x}", "name": f"group-{i - 1:04d}", "options": {}}]
        out.append((f"group-{i:04d}", v))
    return out


class Gerrit(BaseHTTPRequestHandler):
    def do_GET(self):
        with _lock:
            _state["requests"] += 1
            failing = _state["requests"] <= env_int("MOCK_FAIL_FIRST", 0)
        if failing:
            return self.reply(503, b"Service Unavailable")
        if not self.authorized():
            return self.reply(401, b"Unauthorized")
        url = urlparse(self.path)
        q = parse_qs(url.query, keep_blank_values=True)
        n, start = int(q.get("n", ["25"])[0]), int(q.get("S", ["0"])[0])
        opts = set(q.get("o", []))
        if url.path == "/a/accounts/":
            total = env_int("MOCK_GERRIT_ACCOUNTS", 250)
            page = [account(i, "DETAILS" in opts) for i in range(start + 1, min(start + n, total) + 1)]
            if page and start + len(page) < total:
                page[-1]["_more_accounts"] = True
            return self.json(page)
        if url.path == "/a/projects/":
            items = projects("all" in q, "d" in q)
            page = self.slice(items, start, n)
            if page and start + n < len(items):
                page[-1][1]["_more_projects"] = True
            return self.json(dict(page))
        if url.path == "/a/groups/":
            return self.json(dict(self.slice(groups("MEMBERS" in opts, "INCLUDES" in opts), start, n)))
        return self.reply(404, b"Not Found")

    def authorized(self) -> bool:
        expected = base64.b64encode(f"{secret('GERRIT_USERNAME')}:{secret('GERRIT_PASSWORD')}".encode()).decode()
        return self.headers.get("Authorization") == f"Basic {expected}"

    @staticmethod
    def slice(items: list, start: int, n: int) -> list:
        lo = start - 1 if os.environ.get("MOCK_GERRIT_DUP") == "1" and start > 0 else start
        return [(k, dict(v)) for k, v in items[lo:start + n]]

    def json(self, data):
        self.reply(200, (XSSI + json.dumps(data)).encode(), "application/json")

    def reply(self, code, body, ctype="text/plain"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # 요청 로그: 메서드·경로·상태만(자격 증명 없음)
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


class Ghes(Gerrit):
    def do_GET(self):
        with _lock:
            _state["requests"] += 1
            failing = _state["requests"] <= env_int("MOCK_FAIL_FIRST", 0)
        if failing:
            return self.reply(503, b"Service Unavailable")
        if self.headers.get("Authorization") != f"Bearer {secret('GHES_PAT')}":
            return self.reply(401, b"Unauthorized")
        if urlparse(self.path).path != "/stafftools/reports/active_users.csv":
            return self.reply(404, b"Not Found")
        with _lock:
            pending = _state["ghes_pending"] < env_int("MOCK_GHES_PENDING", 2)
            _state["ghes_pending"] = _state["ghes_pending"] + 1 if pending else 0
        if pending:
            return self.reply(202 if os.environ.get("MOCK_GHES_MODE", "202") == "202" else 200, b"")
        self.reply(200, CSV.encode(), "text/csv")


def reset():
    with _lock:
        _state.update(requests=0, ghes_pending=0)


def make_server(kind: str, port: int = 8080, host: str = "0.0.0.0") -> ThreadingHTTPServer:
    reset()
    return ThreadingHTTPServer((host, port), {"gerrit": Gerrit, "ghes": Ghes}[kind])


if __name__ == "__main__":
    make_server(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 8080).serve_forever()
