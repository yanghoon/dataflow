# Airbyte Source의 `get_json_schema()`에 Gerrit Account 필드를 명시적으로 정의

Airbyte S3 Destination이 실제 데이터 컬럼을 생성하려면 `get_json_schema()`의 `properties`에 필드를 명시해야 한다.
`properties: {}`(빈 스키마)만으로는 `discover()`가 반환하는 AirbyteCatalog에 컬럼 목록이 없어, S3에 `_airbyte_*` 메타 필드만 기록되고 Gerrit 데이터는 유실된다.

## Status

Accepted

## Context

Airbyte CDK의 `HttpStream.get_json_schema()`는 `discover()` 단계에서 호출되어 스트림의 컬럼 목록(catalog)을 생성한다.
초기 구현에서는 `properties: {}`와 `additionalProperties: true`만 지정했다.
이 경우 Airbyte UI가 선택 가능한 컬럼을 빈 목록으로 인식하고, S3 Destination이 Gerrit 데이터 필드를 컬럼으로 매핑하지 않는다.
결과적으로 S3 파일에는 `_airbyte_raw_id`, `_airbyte_extracted_at` 등 Airbyte 내부 메타 필드만 존재했다.

## Decision

`GerritStream.get_json_schema()`의 `properties`에 Gerrit Accounts API(`/a/accounts/?o=DETAILS`)가 반환하는 주요 필드를 명시적으로 선언한다.

```python
"properties": {
    "_account_id":      {"type": ["integer", "null"]},
    "username":         {"type": ["string", "null"]},
    "name":             {"type": ["string", "null"]},
    "display_name":     {"type": ["string", "null"]},
    "email":            {"type": ["string", "null"]},
    "secondary_emails": {"type": ["array", "null"], "items": {"type": "string"}},
    "registered_on":    {"type": ["string", "null"]},
    "inactive":         {"type": ["boolean", "null"]},
    "tags":             {"type": ["array", "null"], "items": {"type": "string"}},
    "status":           {"type": ["string", "null"]},
}
```

`additionalProperties: true`는 유지하여 Gerrit API가 새 필드를 추가해도 Raw 데이터에는 보존되도록 한다.

## Consequences

- Airbyte UI에서 Connection의 "Schema" 탭을 **Refresh**해야 새 컬럼이 반영된다.
- 기존 S3 파일은 Gerrit 컬럼이 없으므로 **Full Refresh** 재동기화가 필요하다.
- Gerrit API가 주요 필드를 추가/변경하면 `get_json_schema()`도 함께 업데이트해야 한다.
  (`additionalProperties: true`로 raw에는 살아있지만, Destination 컬럼으로는 나타나지 않음)
