from unittest.mock import MagicMock, patch
import requests
from source_gerrit.source import Accounts, SourceGerrit


def test_source_streams():
    source = SourceGerrit()
    config = {
        "gerrit_url": "https://gerrit.example.com",
        "username": "tester",
        "password": "secret_password",
    }
    streams = source.streams(config)
    assert len(streams) == 1
    assert isinstance(streams[0], Accounts)


def test_source_spec():
    source = SourceGerrit()
    logger = MagicMock()
    spec = source.spec(logger)
    assert spec is not None
    conn_spec = spec.connectionSpecification
    assert "gerrit_url" in conn_spec["properties"]
    assert "username" in conn_spec["properties"]
    assert "password" in conn_spec["properties"]
    assert "page_size" in conn_spec["properties"]
    assert set(conn_spec["required"]) == {"gerrit_url", "username", "password"}



def test_source_check_connection_success():
    source = SourceGerrit()
    config = {
        "gerrit_url": "https://gerrit.example.com/",
        "username": "tester",
        "password": "secret_password",
    }
    logger = MagicMock()

    mock_resp = requests.Response()
    mock_resp.status_code = 200

    with patch("requests.get", return_value=mock_resp) as mock_get:
        success, error = source.check_connection(logger, config)
        assert success is True
        assert error is None
        mock_get.assert_called_once_with(
            "https://gerrit.example.com/a/accounts/self",
            auth=("tester", "secret_password"),
            timeout=30,
        )


def test_source_check_connection_failure():
    source = SourceGerrit()
    config = {
        "gerrit_url": "https://gerrit.example.com",
        "username": "tester",
        "password": "wrong_password",
    }
    logger = MagicMock()

    with patch("requests.get", side_effect=requests.exceptions.HTTPError("401 Client Error: Unauthorized")):
        success, error = source.check_connection(logger, config)
        assert success is False
        assert "401" in str(error)
