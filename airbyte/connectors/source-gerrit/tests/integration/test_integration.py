import os
import logging
import pytest
from source_gerrit.source import SourceGerrit

logger = logging.getLogger("airbyte")

GERRIT_URL = os.getenv("GERRIT_TEST_URL")
GERRIT_USERNAME = os.getenv("GERRIT_TEST_USERNAME")
GERRIT_PASSWORD = os.getenv("GERRIT_TEST_PASSWORD")

skip_if_no_gerrit = pytest.mark.skipif(
    not (GERRIT_URL and GERRIT_USERNAME and GERRIT_PASSWORD),
    reason="GERRIT_TEST_URL, GERRIT_TEST_USERNAME, and GERRIT_TEST_PASSWORD environment variables required for live integration tests",
)


@pytest.mark.integration
@skip_if_no_gerrit
def test_live_gerrit_check_connection():
    config = {
        "gerrit_url": GERRIT_URL,
        "username": GERRIT_USERNAME,
        "password": GERRIT_PASSWORD,
    }
    source = SourceGerrit()
    success, error = source.check_connection(logger, config)
    assert success is True, f"Connection check failed: {error}"


@pytest.mark.integration
@skip_if_no_gerrit
def test_live_gerrit_read_accounts_stream():
    config = {
        "gerrit_url": GERRIT_URL,
        "username": GERRIT_USERNAME,
        "password": GERRIT_PASSWORD,
        "page_size": 10,
    }
    source = SourceGerrit()
    streams = source.streams(config)
    assert len(streams) == 1
    accounts_stream = streams[0]

    # Read records from the first slice
    records = list(accounts_stream.read_records(sync_mode=None))
    assert isinstance(records, list)
    for record in records:
        assert "_account_id" in record
        assert isinstance(record["_account_id"], int)
        assert "_more_accounts" not in record
