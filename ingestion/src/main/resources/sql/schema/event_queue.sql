CREATE TABLE IF NOT EXISTS event_queue (
    seq BIGSERIAL PRIMARY KEY,
    id VARCHAR(64) NOT NULL,
    source VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    datacontenttype VARCHAR(50) DEFAULT 'application/json',
    data JSONB,
    time TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (id, source)
);
