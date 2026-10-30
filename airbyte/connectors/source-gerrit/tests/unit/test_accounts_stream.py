from source_gerrit.source import Accounts


def test_accounts_stream_metadata_and_schema():
    config = {
        "gerrit_url": "https://gerrit.example.com",
        "username": "tester",
        "password": "secret_password",
        "page_size": 50,
    }
    stream = Accounts(config)

    assert stream.primary_key == "_account_id"
    assert stream.path() == "a/accounts/"
    assert stream.url_base == "https://gerrit.example.com/"

    schema = stream.get_json_schema()
    assert schema["type"] == "object"
    assert "properties" in schema
    assert isinstance(schema["properties"], dict)


def test_accounts_stream_request_params():
    config = {
        "gerrit_url": "https://gerrit.example.com",
        "username": "tester",
        "password": "secret_password",
        "page_size": 50,
    }
    stream = Accounts(config)

    params = stream.request_params(stream_state=None, stream_slice=None, next_page_token=None)
    assert params == {"q": "is:active OR is:inactive", "o": "DETAILS", "n": 50}

    params_with_next_page = stream.request_params(
        stream_state=None, stream_slice=None, next_page_token={"S": 50}
    )
    assert params_with_next_page == {
        "q": "is:active OR is:inactive",
        "o": "DETAILS",
        "n": 50,
        "S": 50,
    }


def test_accounts_stream_parse_response_strips_more_accounts():
    config = {
        "gerrit_url": "https://gerrit.example.com",
        "username": "tester",
        "password": "secret_password",
    }
    stream = Accounts(config)

    raw_payload = (
        ")]}'\n"
        "[\n"
        "  {\"_account_id\": 1000000, \"username\": \"admin\", \"name\": \"Administrator\"},\n"
        "  {\"_account_id\": 1000001, \"username\": \"jdoe\", \"name\": \"Jane Doe\", \"_more_accounts\": true}\n"
        "]"
    )
    import requests
    response = requests.Response()
    response._content = raw_payload.encode("utf-8")
    response.status_code = 200

    records = list(stream.parse_response(response))
    assert len(records) == 2
    assert records[0] == {"_account_id": 1000000, "username": "admin", "name": "Administrator"}
    assert records[1] == {"_account_id": 1000001, "username": "jdoe", "name": "Jane Doe"}
    assert "_more_accounts" not in records[1]


def test_accounts_stream_next_page_token_when_more_accounts():
    config = {
        "gerrit_url": "https://gerrit.example.com",
        "username": "tester",
        "password": "secret_password",
    }
    stream = Accounts(config)

    raw_payload = (
        ")]}'\n"
        "[\n"
        "  {\"_account_id\": 1000000, \"username\": \"admin\"},\n"
        "  {\"_account_id\": 1000001, \"username\": \"jdoe\", \"_more_accounts\": true}\n"
        "]"
    )
    import requests
    req = requests.PreparedRequest()
    req.url = "https://gerrit.example.com/a/accounts/?q=is%3Aactive&n=2&S=0"
    response = requests.Response()
    response.request = req
    response._content = raw_payload.encode("utf-8")
    response.status_code = 200

    token = stream.next_page_token(response)
    assert token == {"S": 2}


def test_accounts_stream_next_page_token_when_last_page():
    config = {
        "gerrit_url": "https://gerrit.example.com",
        "username": "tester",
        "password": "secret_password",
    }
    stream = Accounts(config)

    raw_payload = ")]}'\n[{\"_account_id\": 1000000, \"username\": \"admin\"}]"
    import requests
    req = requests.PreparedRequest()
    req.url = "https://gerrit.example.com/a/accounts/?q=is%3Aactive&n=2&S=2"
    response = requests.Response()
    response.request = req
    response._content = raw_payload.encode("utf-8")
    response.status_code = 200

    token = stream.next_page_token(response)
    assert token is None


def test_accounts_stream_next_page_token_handles_error_dict():
    config = {
        "gerrit_url": "https://gerrit.example.com",
        "username": "tester",
        "password": "secret_password",
    }
    stream = Accounts(config)

    raw_payload = ")]}'\n{\"error\": \"Authentication failed\"}"
    import requests
    req = requests.PreparedRequest()
    req.url = "https://gerrit.example.com/a/accounts/?q=is%3Aactive"
    response = requests.Response()
    response.request = req
    response._content = raw_payload.encode("utf-8")
    response.status_code = 401

    token = stream.next_page_token(response)
    assert token is None


