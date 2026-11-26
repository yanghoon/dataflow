from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

import requests
from airbyte_cdk.models import SyncMode
from airbyte_cdk.test.catalog_builder import CatalogBuilder
from airbyte_cdk.test.entrypoint_wrapper import read

from source_gerrit.source import Accounts, Projects, SourceGerrit

CONFIG = {
    "gerrit_url": "https://gerrit.example.com",
    "username": "tester",
    "password": "secret_password",
    "page_size": 2,
}


def _response(body: str, url: str = "https://gerrit.example.com/a/projects/?d&all&n=2") -> requests.Response:
    req = requests.PreparedRequest()
    req.url = url
    resp = requests.Response()
    resp.request = req
    resp.url = url
    resp._content = body.encode("utf-8")
    resp.status_code = 200
    resp.headers["Content-Type"] = "application/json"
    return resp


def test_projects_stream_metadata_and_schema():
    stream = Projects(CONFIG)

    assert stream.name == "projects"
    assert stream.primary_key == "id"
    assert stream.path() == "a/projects/?d&all"
    props = stream.get_json_schema()["properties"]
    assert set(props) == {"id", "name", "parent", "description", "state", "web_links"}


def test_accounts_schema_is_unchanged_after_move_to_file():
    props = Accounts(CONFIG).get_json_schema()["properties"]
    assert set(props) == {
        "_account_id", "username", "name", "display_name", "email",
        "secondary_emails", "registered_on", "inactive", "tags", "status",
    }


def test_projects_stream_request_params():
    stream = Projects(CONFIG)
    assert stream.request_params() == {"n": 2}
    assert stream.request_params(next_page_token={"S": 2}) == {"n": 2, "S": 2}


def test_projects_parse_response_moves_map_key_to_name_and_strips_marker():
    body = (
        ")]}'\n"
        '{"All-Projects": {"id": "All-Projects", "state": "ACTIVE"},'
        ' "team/app": {"id": "team%2Fapp", "parent": "All-Projects", "_more_projects": true}}'
    )
    records = list(Projects(CONFIG).parse_response(_response(body)))
    assert records == [
        {"name": "All-Projects", "id": "All-Projects", "state": "ACTIVE"},
        {"name": "team/app", "id": "team%2Fapp", "parent": "All-Projects"},
    ]


def test_projects_next_page_token():
    stream = Projects(CONFIG)
    more = ")]}'\n" '{"a": {"id": "a"}, "b": {"id": "b", "_more_projects": true}}'
    last = ")]}'\n" '{"c": {"id": "c"}}'

    assert stream.next_page_token(_response(more, "https://gerrit.example.com/a/projects/?d&all&n=2&S=2")) == {"S": 4}
    assert stream.next_page_token(_response(last)) is None


def test_projects_error_or_non_map_response_yields_nothing():
    stream = Projects(CONFIG)
    for body in [")]}'\n[]", ")]}'\n{\"error\": \"denied\"}", "not json"]:
        assert list(stream.parse_response(_response(body))) == []
        assert stream.next_page_token(_response(body)) is None


def test_projects_sync_pages_through_offsets_with_valueless_options():
    """Full sync through the CDK entrypoint; only the network send is faked.

    The CDK reads one page per Resumable Full Refresh slice, so `read_records()` alone
    stops after page 1. The source read loop requests the next pages.
    """
    pages = {
        "0": ")]}'\n" '{"a": {"id": "a"}, "b": {"id": "b", "_more_projects": true}}',
        "2": ")]}'\n" '{"c": {"id": "c"}}',
    }
    sent_urls = []

    def fake_send(session, request, **kwargs):
        sent_urls.append(request.url)
        start = parse_qs(urlparse(request.url).query).get("S", ["0"])[0]
        resp = _response(pages[start], request.url)
        resp.request = request
        return resp

    catalog = CatalogBuilder().with_stream("projects", SyncMode.full_refresh).build()
    with patch("source_gerrit.source._orig_send", fake_send):
        output = read(SourceGerrit(), CONFIG, catalog)

    assert output.errors == []
    records = [m.record.data for m in output.records]
    assert [r["name"] for r in records] == ["a", "b", "c"]
    assert all("_more_projects" not in r for r in records)
    assert len(sent_urls) == 2
    for url in sent_urls:
        assert urlparse(url).path == "/a/projects/"
        assert urlparse(url).query.startswith("d&all&n=2")
    assert sent_urls[1].endswith("S=2")
