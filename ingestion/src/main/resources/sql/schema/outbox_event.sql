CREATE TABLE IF NOT EXISTS outbox_event (
    id VARCHAR(128) NOT NULL,              -- CloudEvent id
    source VARCHAR(255) NOT NULL,          -- CloudEvent source
    type VARCHAR(255) NOT NULL,            -- CloudEvent type
    subject VARCHAR(255),                  -- CloudEvent subject (옵션)
    time TIMESTAMP WITH TIME ZONE NOT NULL,-- CloudEvent 발생 시각
    data_payload JSONB,                    -- CloudEvent data (본문 JSON)
    extensions JSONB,                      -- CloudEvent 커스텀 확장 필드
    status VARCHAR(20) NOT NULL DEFAULT 'READY', -- 상태: READY, DONE, FAILED 등
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (source, id)               -- CloudEvents 스펙상 고유성 보장
);

-- Poller가 status와 type 조합으로 빠르게 조회하기 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_outbox_event_status_type 
ON outbox_event (status, type);
