create table IF NOT EXISTS scheduled_tasks (
    task_name varchar(100),
    task_instance varchar(100),
    task_data blob,
    execution_time TIMESTAMP,
    picked BIT,
    picked_by varchar(50),
    last_success TIMESTAMP,
    last_failure TIMESTAMP,
    consecutive_failures INT,
    last_heartbeat TIMESTAMP,
    version BIGINT,
    priority SMALLINT,
    PRIMARY KEY (task_name, task_instance)
);

CREATE INDEX IF NOT EXISTS execution_time_idx ON scheduled_tasks (execution_time);
CREATE INDEX IF NOT EXISTS last_heartbeat_idx ON scheduled_tasks (last_heartbeat);
-- CREATE INDEX IF NOT EXISTS priority_execution_time_idx on scheduled_tasks (priority, execution_time);

create table IF NOT EXISTS scheduled_execution_logs (
    id                   INTEGER                  not null primary key AUTOINCREMENT,
    task_name            text                     not null,
    task_instance        text                     not null,
    task_data            blob,
    picked_by            text,
    time_started         TIMESTAMP                not null,
    time_finished        TIMESTAMP                not null,
    succeeded            BOOLEAN                  not null,
    duration_ms          BIGINT                   not null,
    exception_class      text,
    exception_message    text,
    exception_stacktrace text
);

CREATE INDEX IF NOT EXISTS stl_started_idx         ON scheduled_execution_logs (time_started);
CREATE INDEX IF NOT EXISTS stl_task_name_idx       ON scheduled_execution_logs (task_name);
CREATE INDEX IF NOT EXISTS stl_exception_class_idx ON scheduled_execution_logs (exception_class);
