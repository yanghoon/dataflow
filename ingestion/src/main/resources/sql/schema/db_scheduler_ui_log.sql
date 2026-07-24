CREATE TABLE IF NOT EXISTS scheduled_execution_logs (
  id BIGSERIAL PRIMARY KEY,
  task_name TEXT NOT NULL,
  task_instance TEXT NOT NULL,
  task_data BYTEA,
  picked_by TEXT,
  time_started TIMESTAMP WITH TIME ZONE NOT NULL,
  time_finished TIMESTAMP WITH TIME ZONE NOT NULL,
  succeeded BOOLEAN NOT NULL,
  duration_ms BIGINT NOT NULL,
  exception_class TEXT,
  exception_message TEXT,
  exception_stacktrace TEXT
);

CREATE INDEX IF NOT EXISTS ix_scheduled_execution_logs_task_name ON scheduled_execution_logs (task_name);
CREATE INDEX IF NOT EXISTS ix_scheduled_execution_logs_time_started ON scheduled_execution_logs (time_started);
