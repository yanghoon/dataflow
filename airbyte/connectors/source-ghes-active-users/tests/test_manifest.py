import pathlib

import yaml

MANIFEST = yaml.safe_load(
    (pathlib.Path(__file__).parent.parent / "manifest.yaml").read_text()
)
REQUESTER = MANIFEST["definitions"]["requester"]
RETRIEVER = MANIFEST["definitions"]["retriever"]


def test_retries_only_on_202():
    flt = REQUESTER["error_handler"]["response_filters"][0]
    assert flt["action"] == "RETRY"
    assert flt["http_codes"] == [202]


def test_retry_settings_come_from_config():
    eh = REQUESTER["error_handler"]
    assert "config['max_retries']" in eh["max_retries"]
    backoff = eh["backoff_strategies"][0]
    assert "config['retry_interval_seconds']" in backoff["backoff_time_in_seconds"]


def test_default_wait_is_ten_minutes():
    props = MANIFEST["spec"]["connection_specification"]["properties"]
    assert props["max_retries"]["default"] * props["retry_interval_seconds"]["default"] == 600


def test_csv_decoder_on_retriever_and_extractor():
    assert RETRIEVER["decoder"]["$ref"] == "#/definitions/csv_decoder"
    assert RETRIEVER["record_selector"]["extractor"]["decoder"]["$ref"] == "#/definitions/csv_decoder"


def test_no_body_based_retry_predicate():
    flt = REQUESTER["error_handler"]["response_filters"][0]
    assert "predicate" not in flt
