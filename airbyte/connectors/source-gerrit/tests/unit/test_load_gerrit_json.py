import requests
from source_gerrit.source import load_gerrit_json


def test_load_gerrit_json_removes_xssi_magic_string():
    raw_payload = ")]}'\n[{\"_account_id\": 1000000, \"name\": \"Jane Doe\"}]"
    response = requests.Response()
    response._content = raw_payload.encode("utf-8")
    response.status_code = 200

    result = load_gerrit_json(response)

    assert result == [{"_account_id": 1000000, "name": "Jane Doe"}]


def test_load_gerrit_json_handles_invalid_json_gracefully():
    raw_payload = ")]}'\nnot valid json"
    response = requests.Response()
    response._content = raw_payload.encode("utf-8")
    response.status_code = 500

    result = load_gerrit_json(response)

    assert result == []


def test_load_gerrit_json_handles_empty_response():
    response = requests.Response()
    response._content = b"   "
    response.status_code = 204

    result = load_gerrit_json(response)

    assert result == []


def test_load_gerrit_json_parses_single_object_dict():
    raw_payload = ")]}'\n{\"_account_id\": 1000000, \"username\": \"admin\"}"
    response = requests.Response()
    response._content = raw_payload.encode("utf-8")
    response.status_code = 200

    result = load_gerrit_json(response)

    assert result == {"_account_id": 1000000, "username": "admin"}
