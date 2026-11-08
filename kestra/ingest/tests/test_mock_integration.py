"""목 서버에 붙여 보는 시험. Kestra 없이 돈다: `pytest kestra/ingest/tests`"""

import json
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "mock"))
sys.path.insert(0, str(ROOT / "_files" / "gerrit"))

import gerrit  # noqa: E402
import server  # noqa: E402


@pytest.fixture
def secrets_dir(tmp_path, monkeypatch):
    d = tmp_path / "secrets"
    d.mkdir()
    for name, value in {"GERRIT_USERNAME": "u", "GERRIT_PASSWORD": "p", "GHES_PAT": "t"}.items():
        (d / name).write_text(value + "\n")
    monkeypatch.setenv("MOCK_SECRETS_DIR", str(d))
    for var in ("MOCK_FAIL_FIRST", "MOCK_GERRIT_DUP"):
        monkeypatch.delenv(var, raising=False)
    return d


@pytest.fixture
def serve():
    servers = []

    def start(kind):
        srv = server.make_server(kind, 0, "127.0.0.1")  # 0.0.0.0은 일부 환경에서 getfqdn이 5초 걸린다
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        servers.append(srv)
        return f"http://127.0.0.1:{srv.server_address[1]}"

    yield start
    for srv in servers:
        srv.shutdown()


# Gerrit ----------------------------------------------------------------------------------------

def test_three_streams_full_counts_and_shapes(secrets_dir, serve, tmp_path, monkeypatch):
    base = serve("gerrit")
    monkeypatch.setenv("GERRIT_URL", base)
    monkeypatch.setenv("GERRIT_USERNAME_FILE", str(secrets_dir / "GERRIT_USERNAME"))
    monkeypatch.setenv("GERRIT_PASSWORD_FILE", str(secrets_dir / "GERRIT_PASSWORD"))
    monkeypatch.setenv("GERRIT_PAGE_SIZE", "100")
    out = tmp_path / "out"
    out.mkdir()
    assert gerrit.main(["--out-dir", str(out)]) == 0

    rows = {s: [json.loads(line) for line in (out / f"{s}.jsonl").read_text().splitlines()] for s in gerrit.STREAMS}
    assert [len(rows[s]) for s in gerrit.STREAMS] == [250, 250, 200]                  # IR1, IG3
    assert rows["account"][0]["email"] == "user1@example.com"                         # o=DETAILS
    assert sum(r["state"] == "HIDDEN" for r in rows["project"]) == 25                 # all
    assert rows["project"][0] == {"name": "team/project-0001", "id": "team%2Fproject-0001",
                                  "parent": "All-Projects", "state": "ACTIVE", "description": "Project 1"}
    assert all("name" in r for r in rows["project"] + rows["group"])                  # IG4
    assert rows["group"][1]["members"][0]["_account_id"] == 2                         # o=MEMBERS
    assert rows["group"][1]["includes"][0]["id"] == rows["group"][0]["id"]            # o=INCLUDES
    assert not any(k.startswith("_more") for s in rows for r in rows[s] for k in r)   # IR3


def test_page_boundary_duplicates_are_dropped(secrets_dir, serve, monkeypatch):
    monkeypatch.setenv("MOCK_GERRIT_DUP", "1")
    fetch = gerrit.make_fetcher(serve("gerrit"), "u", "p")
    names = [r["name"] for r in gerrit.iter_projects(fetch, 100)]
    assert len(names) == len(set(names)) == 250                                      # IG7


def test_wrong_password_is_401(secrets_dir, serve):
    fetch = gerrit.make_fetcher(serve("gerrit"), "u", "wrong")
    with pytest.raises(urllib.error.HTTPError) as err:
        list(gerrit.iter_accounts(fetch, 10))
    assert err.value.code == 401                                                      # IR6


def test_fail_first_returns_503_then_recovers(secrets_dir, serve, monkeypatch):
    monkeypatch.setenv("MOCK_FAIL_FIRST", "2")
    fetch = gerrit.make_fetcher(serve("gerrit"), "u", "p")
    for _ in range(2):
        with pytest.raises(urllib.error.HTTPError) as err:
            list(gerrit.iter_accounts(fetch, 100))
        assert err.value.code == 503
    assert len(list(gerrit.iter_accounts(fetch, 100))) == 250                         # Kestra 재시도가 이 경로를 탄다


def test_secret_file_change_takes_effect_without_restart(secrets_dir, serve):
    base = serve("gerrit")
    (secrets_dir / "GERRIT_PASSWORD").write_text("rotated\n")
    with pytest.raises(urllib.error.HTTPError):
        list(gerrit.iter_accounts(gerrit.make_fetcher(base, "u", "p"), 10))
    assert len(list(gerrit.iter_accounts(gerrit.make_fetcher(base, "u", "rotated"), 100))) == 250


# GHES ------------------------------------------------------------------------------------------

@pytest.mark.parametrize("mode, pending_code", [("202", 202), ("empty", 200)])
def test_ghes_returns_pending_then_csv(secrets_dir, serve, monkeypatch, mode, pending_code):
    monkeypatch.setenv("MOCK_GHES_PENDING", "2")
    monkeypatch.setenv("MOCK_GHES_MODE", mode)
    req = urllib.request.Request(serve("ghes") + "/stafftools/reports/active_users.csv",
                                 headers={"Authorization": "Bearer t"})
    responses = []
    for _ in range(4):
        with urllib.request.urlopen(req) as resp:
            responses.append((resp.status, resp.read()))
    assert responses[:2] == [(pending_code, b"")] * 2                                 # IH2
    assert responses[2] == (200, server.CSV.encode())                                 # IH4
    assert responses[3] == (pending_code, b"")                                        # 다시 센다


def test_ghes_wrong_token_is_401(secrets_dir, serve):
    req = urllib.request.Request(serve("ghes") + "/stafftools/reports/active_users.csv",
                                 headers={"Authorization": "Bearer nope"})
    with pytest.raises(urllib.error.HTTPError) as err:
        urllib.request.urlopen(req)
    assert err.value.code == 401
