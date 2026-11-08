"""gerrit.py 단위 시험. 네트워크 없이 돈다: `pytest kestra/ingest/tests`"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "_files" / "gerrit"))

import gerrit  # noqa: E402

X = ")]}'\n"


# IG2 -------------------------------------------------------------------------------------------

def test_parse_strips_xssi_prefix():
    assert gerrit.parse_gerrit_json(X + '[{"_account_id": 1}]', list) == [{"_account_id": 1}]
    assert gerrit.parse_gerrit_json(X + '{"p": {"id": "p"}}', dict) == {"p": {"id": "p"}}


def test_parse_empty_body_is_empty_container():
    assert gerrit.parse_gerrit_json(X, list) == []
    assert gerrit.parse_gerrit_json("", dict) == {}


def test_parse_rejects_wrong_shape():
    with pytest.raises(ValueError):
        gerrit.parse_gerrit_json(X + '{"a": 1}', list)
    with pytest.raises(ValueError):
        gerrit.parse_gerrit_json(X + "[]", dict)


# IG3 · IG4 · IG7 -------------------------------------------------------------------------------

def fake(pages):
    calls = []

    def fetch(path, query):
        calls.append((path, query))
        return X + json.dumps(pages[len(calls) - 1])

    return fetch, calls


def test_accounts_follow_more_accounts():
    fetch, calls = fake([[{"_account_id": 1}, {"_account_id": 2, "_more_accounts": True}], [{"_account_id": 3}]])
    records = list(gerrit.iter_accounts(fetch, 2))
    assert [r["_account_id"] for r in records] == [1, 2, 3]
    assert all("_more_accounts" not in r for r in records)
    assert [c[0] for c in calls] == ["/a/accounts/"] * 2
    assert "o=DETAILS" in calls[0][1] and "S=2" in calls[1][1]


def test_projects_move_key_to_name_and_follow_more_projects():
    fetch, calls = fake([{"a": {"id": "a"}, "b": {"id": "b", "_more_projects": True}}, {"c": {"id": "c"}}])
    records = list(gerrit.iter_projects(fetch, 2))
    assert records == [{"name": "a", "id": "a"}, {"name": "b", "id": "b"}, {"name": "c", "id": "c"}]
    assert calls[0] == ("/a/projects/", "d&all&n=2&S=0") and calls[1][1].endswith("S=2")


def test_groups_end_when_page_is_short_and_ask_members_includes():
    fetch, calls = fake([{"g1": {"id": "1"}, "g2": {"id": "2"}}, {"g3": {"id": "3"}}])
    assert [r["name"] for r in gerrit.iter_groups(fetch, 2)] == ["g1", "g2", "g3"]
    assert len(calls) == 2
    assert "o=MEMBERS" in calls[0][1] and "o=INCLUDES" in calls[0][1]


def test_groups_exact_multiple_needs_one_empty_page():
    fetch, calls = fake([{"g1": {"id": "1"}, "g2": {"id": "2"}}, {}])
    assert len(list(gerrit.iter_groups(fetch, 2))) == 2
    assert len(calls) == 2


def test_map_page_boundary_duplicate_is_written_once():
    fetch, _ = fake([{"a": {"id": "a"}, "b": {"id": "b", "_more_projects": True}}, {"b": {"id": "b"}, "c": {"id": "c"}}])
    assert [r["name"] for r in gerrit.iter_projects(fetch, 2)] == ["a", "b", "c"]


def test_existing_name_is_kept():
    fetch, _ = fake([{"key": {"id": "x", "name": "real"}}])
    assert list(gerrit.iter_groups(fetch, 10)) == [{"id": "x", "name": "real"}]


# IR4 -------------------------------------------------------------------------------------------

def test_read_secret_prefers_file_and_strips(tmp_path, monkeypatch):
    f = tmp_path / "GERRIT_PASSWORD"
    f.write_text("from-file\n")
    monkeypatch.setenv("GERRIT_PASSWORD_FILE", str(f))
    monkeypatch.setenv("GERRIT_PASSWORD", "from-env")
    assert gerrit.read_secret("GERRIT_PASSWORD") == "from-file"


def test_read_secret_falls_back_to_env(monkeypatch):
    monkeypatch.delenv("GERRIT_PASSWORD_FILE", raising=False)
    monkeypatch.setenv("GERRIT_PASSWORD", "from-env")
    assert gerrit.read_secret("GERRIT_PASSWORD") == "from-env"


def test_read_secret_missing_raises_without_value(monkeypatch):
    monkeypatch.delenv("GERRIT_PASSWORD_FILE", raising=False)
    monkeypatch.delenv("GERRIT_PASSWORD", raising=False)
    with pytest.raises(KeyError):
        gerrit.read_secret("GERRIT_PASSWORD")


# IG5 -------------------------------------------------------------------------------------------

def test_main_fails_when_any_stream_is_empty(tmp_path, monkeypatch):
    monkeypatch.setenv("GERRIT_URL", "https://gerrit.invalid")
    monkeypatch.setenv("GERRIT_USERNAME", "u")
    monkeypatch.setenv("GERRIT_PASSWORD", "p")
    bodies = {"/a/accounts/": '[{"_account_id": 1}]', "/a/projects/": '{"p": {"id": "p"}}', "/a/groups/": "{}"}
    monkeypatch.setattr(gerrit, "make_fetcher", lambda *a: lambda path, q: X + bodies[path])
    assert gerrit.main(["--out-dir", str(tmp_path)]) == 1
    assert (tmp_path / "account.jsonl").read_text().count("\n") == 1
