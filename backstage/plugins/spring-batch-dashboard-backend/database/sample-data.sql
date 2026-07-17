-- Spring Batch Sample Data
-- Sample data for Boot 3 and Boot 4 tables with various job execution states

-- ===========================================
-- Boot 3 Sample Data (Spring Batch 5)
-- ===========================================

-- Job 1: User Sync Job (COMPLETED) - Boot 3
INSERT INTO boot3_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (1, 0, 'userSyncJob', 'd41d8cd98f00b204e9800998ecf8427e');

INSERT INTO boot3_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  1, 0, 1,
  CURRENT_TIMESTAMP - INTERVAL '2 hours',
  CURRENT_TIMESTAMP - INTERVAL '2 hours',
  CURRENT_TIMESTAMP - INTERVAL '1 hour 50 minutes',
  'COMPLETED', 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '1 hour 50 minutes'
);

INSERT INTO boot3_batch_job_execution_params (job_execution_id, parameter_name, parameter_type, parameter_value, identifying)
VALUES
  (1, 'date', 'java.lang.String', '2026-03-06', 'Y'),
  (1, 'environment', 'java.lang.String', 'dev', 'Y');

INSERT INTO boot3_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (1, 0, 'readUsersStep', 1,
   CURRENT_TIMESTAMP - INTERVAL '2 hours',
   CURRENT_TIMESTAMP - INTERVAL '2 hours',
   CURRENT_TIMESTAMP - INTERVAL '1 hour 55 minutes',
   'COMPLETED', 100, 1000, 0, 1000, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '1 hour 55 minutes'),
  (2, 0, 'processUsersStep', 1,
   CURRENT_TIMESTAMP - INTERVAL '1 hour 55 minutes',
   CURRENT_TIMESTAMP - INTERVAL '1 hour 55 minutes',
   CURRENT_TIMESTAMP - INTERVAL '1 hour 50 minutes',
   'COMPLETED', 50, 1000, 50, 950, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '1 hour 50 minutes');

-- Job 2: Order Process Job (FAILED) - Boot 3
INSERT INTO boot3_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (2, 0, 'orderProcessJob', 'a7ffc6f8bf1ed76651c14756a061d662');

INSERT INTO boot3_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  2, 0, 2,
  CURRENT_TIMESTAMP - INTERVAL '1 hour',
  CURRENT_TIMESTAMP - INTERVAL '1 hour',
  CURRENT_TIMESTAMP - INTERVAL '55 minutes',
  'FAILED', 'FAILED', 'Database connection timeout', CURRENT_TIMESTAMP - INTERVAL '55 minutes'
);

INSERT INTO boot3_batch_job_execution_params (job_execution_id, parameter_name, parameter_type, parameter_value, identifying)
VALUES
  (2, 'startDate', 'java.lang.String', '2026-03-05', 'Y'),
  (2, 'endDate', 'java.lang.String', '2026-03-06', 'Y');

INSERT INTO boot3_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (3, 0, 'loadOrdersStep', 2,
   CURRENT_TIMESTAMP - INTERVAL '1 hour',
   CURRENT_TIMESTAMP - INTERVAL '1 hour',
   CURRENT_TIMESTAMP - INTERVAL '55 minutes',
   'FAILED', 5, 250, 0, 250, 0, 0, 0, 3, 'FAILED', 'Connection timeout after 30s', CURRENT_TIMESTAMP - INTERVAL '55 minutes');

-- Job 3: Report Generation Job (RUNNING) - Boot 3
INSERT INTO boot3_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (3, 0, 'reportGenerationJob', 'c4ca4238a0b923820dcc509a6f75849b');

INSERT INTO boot3_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  3, 0, 3,
  CURRENT_TIMESTAMP - INTERVAL '10 minutes',
  CURRENT_TIMESTAMP - INTERVAL '10 minutes',
  NULL,
  'STARTED', 'UNKNOWN', '', CURRENT_TIMESTAMP - INTERVAL '1 minute'
);

INSERT INTO boot3_batch_job_execution_params (job_execution_id, parameter_name, parameter_type, parameter_value, identifying)
VALUES
  (3, 'reportType', 'java.lang.String', 'DAILY_SALES', 'Y'),
  (3, 'date', 'java.lang.String', '2026-03-06', 'Y');

INSERT INTO boot3_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (4, 0, 'aggregateDataStep', 3,
   CURRENT_TIMESTAMP - INTERVAL '10 minutes',
   CURRENT_TIMESTAMP - INTERVAL '10 minutes',
   NULL,
   'STARTED', 30, 1500, 0, 1500, 0, 0, 0, 0, 'EXECUTING', '', CURRENT_TIMESTAMP - INTERVAL '1 minute');

-- Job 4: CSV Import Job (COMPLETED) - Boot 3
INSERT INTO boot3_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (4, 0, 'csvImportJob', 'csv_import_20260306_001');

INSERT INTO boot3_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  4, 0, 4,
  CURRENT_TIMESTAMP - INTERVAL '5 hours',
  CURRENT_TIMESTAMP - INTERVAL '5 hours',
  CURRENT_TIMESTAMP - INTERVAL '4 hours 30 minutes',
  'COMPLETED', 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '4 hours 30 minutes'
);

INSERT INTO boot3_batch_job_execution_params (job_execution_id, parameter_name, parameter_type, parameter_value, identifying)
VALUES
  (4, 'fileName', 'java.lang.String', 'products_20260306.csv', 'Y'),
  (4, 'batchSize', 'java.lang.Long', '1000', 'N');

INSERT INTO boot3_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (5, 0, 'readCsvStep', 4,
   CURRENT_TIMESTAMP - INTERVAL '5 hours',
   CURRENT_TIMESTAMP - INTERVAL '5 hours',
   CURRENT_TIMESTAMP - INTERVAL '4 hours 50 minutes',
   'COMPLETED', 50, 50000, 0, 50000, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '4 hours 50 minutes'),
  (6, 0, 'validateStep', 4,
   CURRENT_TIMESTAMP - INTERVAL '4 hours 50 minutes',
   CURRENT_TIMESTAMP - INTERVAL '4 hours 50 minutes',
   CURRENT_TIMESTAMP - INTERVAL '4 hours 40 minutes',
   'COMPLETED', 50, 50000, 150, 49850, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '4 hours 40 minutes'),
  (7, 0, 'importToDatabaseStep', 4,
   CURRENT_TIMESTAMP - INTERVAL '4 hours 40 minutes',
   CURRENT_TIMESTAMP - INTERVAL '4 hours 40 minutes',
   CURRENT_TIMESTAMP - INTERVAL '4 hours 30 minutes',
   'COMPLETED', 50, 49850, 0, 49850, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '4 hours 30 minutes');

-- Job 5: Product Sync Job (COMPLETED) - Boot 3
INSERT INTO boot3_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (5, 0, 'productSyncJob', 'product_sync_key_001');

INSERT INTO boot3_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  5, 0, 5,
  CURRENT_TIMESTAMP - INTERVAL '3 hours',
  CURRENT_TIMESTAMP - INTERVAL '3 hours',
  CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes',
  'COMPLETED', 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes'
);

INSERT INTO boot3_batch_job_execution_params (job_execution_id, parameter_name, parameter_type, parameter_value, identifying)
VALUES
  (5, 'date', 'java.lang.String', '2026-03-06', 'Y');

INSERT INTO boot3_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (8, 0, 'fetchProductsStep', 5,
   CURRENT_TIMESTAMP - INTERVAL '3 hours',
   CURRENT_TIMESTAMP - INTERVAL '3 hours',
   CURRENT_TIMESTAMP - INTERVAL '2 hours 30 minutes',
   'COMPLETED', 100, 10000, 0, 10000, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '2 hours 30 minutes'),
  (9, 0, 'updateProductsStep', 5,
   CURRENT_TIMESTAMP - INTERVAL '2 hours 30 minutes',
   CURRENT_TIMESTAMP - INTERVAL '2 hours 30 minutes',
   CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes',
   'COMPLETED', 100, 10000, 0, 10000, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes');

-- ===========================================
-- Boot 4 Sample Data (Spring Batch 6)
-- ===========================================

-- Job 6: Data Migration Job (COMPLETED) - Boot 4
INSERT INTO boot4_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (6, 0, 'dataMigrationJob', 'e4da3b7fbbce2345d7772b0674a318d5');

INSERT INTO boot4_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  6, 0, 6,
  CURRENT_TIMESTAMP - INTERVAL '3 days',
  CURRENT_TIMESTAMP - INTERVAL '3 days',
  CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '2 hours',
  'COMPLETED', 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '2 hours'
);

INSERT INTO boot4_batch_job_execution_params (job_execution_id, parameter_name, parameter_type, parameter_value, identifying)
VALUES
  (6, 'sourceTable', 'java.lang.String', 'old_users', 'Y'),
  (6, 'targetTable', 'java.lang.String', 'new_users', 'Y'),
  (6, 'batchSize', 'java.lang.Long', '500', 'N');

INSERT INTO boot4_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (10, 0, 'extractStep', 6,
   CURRENT_TIMESTAMP - INTERVAL '3 days',
   CURRENT_TIMESTAMP - INTERVAL '3 days',
   CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '1 hour',
   'COMPLETED', 200, 100000, 0, 100000, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '1 hour'),
  (11, 0, 'transformStep', 6,
   CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '1 hour',
   CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '1 hour',
   CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '1 hour 30 minutes',
   'COMPLETED', 100, 100000, 5000, 95000, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '1 hour 30 minutes'),
  (12, 0, 'loadStep', 6,
   CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '1 hour 30 minutes',
   CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '1 hour 30 minutes',
   CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '2 hours',
   'COMPLETED', 190, 95000, 0, 95000, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '2 hours');

-- Job 7: Email Notification Job (COMPLETED) - Boot 4
INSERT INTO boot4_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (7, 0, 'emailNotificationJob', '1679091c5a880faf6fb5e6087eb1b2dc');

INSERT INTO boot4_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  7, 0, 7,
  CURRENT_TIMESTAMP - INTERVAL '30 minutes',
  CURRENT_TIMESTAMP - INTERVAL '30 minutes',
  CURRENT_TIMESTAMP - INTERVAL '25 minutes',
  'COMPLETED', 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '25 minutes'
);

INSERT INTO boot4_batch_job_execution_params (job_execution_id, parameter_name, parameter_type, parameter_value, identifying)
VALUES
  (7, 'campaignId', 'java.lang.String', 'CAMPAIGN_2026_03', 'Y'),
  (7, 'recipientCount', 'java.lang.Long', '5000', 'N');

INSERT INTO boot4_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (13, 0, 'sendEmailsStep', 7,
   CURRENT_TIMESTAMP - INTERVAL '30 minutes',
   CURRENT_TIMESTAMP - INTERVAL '30 minutes',
   CURRENT_TIMESTAMP - INTERVAL '25 minutes',
   'COMPLETED', 100, 5000, 200, 4800, 0, 50, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '25 minutes');

-- Job 8: Payment Processing Job (FAILED) - Boot 4
INSERT INTO boot4_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (8, 0, 'paymentProcessingJob', '8f14e45fceea167a5a36dedd4bea2543');

INSERT INTO boot4_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  8, 0, 8,
  CURRENT_TIMESTAMP - INTERVAL '45 minutes',
  CURRENT_TIMESTAMP - INTERVAL '45 minutes',
  CURRENT_TIMESTAMP - INTERVAL '40 minutes',
  'FAILED', 'FAILED', 'Payment gateway timeout', CURRENT_TIMESTAMP - INTERVAL '40 minutes'
);

INSERT INTO boot4_batch_job_execution_params (job_execution_id, parameter_name, parameter_type, parameter_value, identifying)
VALUES
  (8, 'paymentDate', 'java.lang.String', '2026-03-06', 'Y'),
  (8, 'batchId', 'java.lang.String', 'BATCH_001', 'Y');

INSERT INTO boot4_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (14, 0, 'processPaymentsStep', 8,
   CURRENT_TIMESTAMP - INTERVAL '45 minutes',
   CURRENT_TIMESTAMP - INTERVAL '45 minutes',
   CURRENT_TIMESTAMP - INTERVAL '40 minutes',
   'FAILED', 10, 500, 0, 300, 0, 0, 0, 5, 'FAILED', 'Gateway timeout after 60s', CURRENT_TIMESTAMP - INTERVAL '40 minutes');

-- Job 9: Cleanup Job (COMPLETED) - Boot 4
INSERT INTO boot4_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (9, 0, 'cleanupJob', 'cleanup_job_key_001');

INSERT INTO boot4_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  9, 0, 9,
  CURRENT_TIMESTAMP - INTERVAL '6 hours',
  CURRENT_TIMESTAMP - INTERVAL '6 hours',
  CURRENT_TIMESTAMP - INTERVAL '5 hours 45 minutes',
  'COMPLETED', 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '5 hours 45 minutes'
);

INSERT INTO boot4_batch_job_execution_params (job_execution_id, parameter_name, parameter_type, parameter_value, identifying)
VALUES
  (9, 'olderThan', 'java.lang.String', '30', 'Y'),
  (9, 'dryRun', 'java.lang.Boolean', 'false', 'N');

INSERT INTO boot4_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (15, 0, 'deleteOldRecordsStep', 9,
   CURRENT_TIMESTAMP - INTERVAL '6 hours',
   CURRENT_TIMESTAMP - INTERVAL '6 hours',
   CURRENT_TIMESTAMP - INTERVAL '5 hours 45 minutes',
   'COMPLETED', 100, 15000, 0, 15000, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '5 hours 45 minutes');

-- Job 10: Analytics Job (RUNNING) - Boot 4
INSERT INTO boot4_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (10, 0, 'analyticsJob', 'analytics_job_key_001');

INSERT INTO boot4_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  10, 0, 10,
  CURRENT_TIMESTAMP - INTERVAL '5 minutes',
  CURRENT_TIMESTAMP - INTERVAL '5 minutes',
  NULL,
  'STARTED', 'UNKNOWN', '', CURRENT_TIMESTAMP
);

INSERT INTO boot4_batch_job_execution_params (job_execution_id, parameter_name, parameter_type, parameter_value, identifying)
VALUES
  (10, 'analysisType', 'java.lang.String', 'WEEKLY_SUMMARY', 'Y');

INSERT INTO boot4_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (16, 0, 'collectDataStep', 10,
   CURRENT_TIMESTAMP - INTERVAL '5 minutes',
   CURRENT_TIMESTAMP - INTERVAL '5 minutes',
   NULL,
   'STARTED', 10, 5000, 0, 5000, 0, 0, 0, 0, 'EXECUTING', '', CURRENT_TIMESTAMP);

-- ===========================================
-- Same Job Name in both Boot 3 and Boot 4 (for UNION testing)
-- ===========================================

-- Inventory Sync Job - Boot 3 version
INSERT INTO boot3_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (100, 0, 'inventorySyncJob', 'boot3_inv_key_001');

INSERT INTO boot3_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  100, 0, 100,
  CURRENT_TIMESTAMP - INTERVAL '2 hours',
  CURRENT_TIMESTAMP - INTERVAL '2 hours',
  CURRENT_TIMESTAMP - INTERVAL '1 hour 55 minutes',
  'COMPLETED', 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '1 hour 55 minutes'
);

INSERT INTO boot3_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (100, 0, 'syncInventoryStep', 100,
   CURRENT_TIMESTAMP - INTERVAL '2 hours',
   CURRENT_TIMESTAMP - INTERVAL '2 hours',
   CURRENT_TIMESTAMP - INTERVAL '1 hour 55 minutes',
   'COMPLETED', 50, 2000, 0, 2000, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '1 hour 55 minutes');

-- Inventory Sync Job - Boot 4 version (same Job Name)
INSERT INTO boot4_batch_job_instance (job_instance_id, version, job_name, job_key)
VALUES (101, 0, 'inventorySyncJob', 'boot4_inv_key_001');

INSERT INTO boot4_batch_job_execution (
  job_execution_id, version, job_instance_id, create_time, start_time, end_time,
  status, exit_code, exit_message, last_updated
) VALUES (
  101, 0, 101,
  CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes',
  CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes',
  CURRENT_TIMESTAMP - INTERVAL '1 hour 25 minutes',
  'COMPLETED', 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '1 hour 25 minutes'
);

INSERT INTO boot4_batch_step_execution (
  step_execution_id, version, step_name, job_execution_id, create_time, start_time, end_time,
  status, commit_count, read_count, filter_count, write_count,
  read_skip_count, write_skip_count, process_skip_count, rollback_count,
  exit_code, exit_message, last_updated
) VALUES
  (101, 0, 'syncInventoryStep', 101,
   CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes',
   CURRENT_TIMESTAMP - INTERVAL '1 hour 30 minutes',
   CURRENT_TIMESTAMP - INTERVAL '1 hour 25 minutes',
   'COMPLETED', 50, 2000, 0, 2000, 0, 0, 0, 0, 'COMPLETED', '', CURRENT_TIMESTAMP - INTERVAL '1 hour 25 minutes');

-- Update sequences
-- Boot 3 sequences
SELECT setval('boot3_batch_job_seq', 100, true);
SELECT setval('boot3_batch_job_execution_seq', 100, true);
SELECT setval('boot3_batch_step_execution_seq', 100, true);

-- Boot 4 sequences
SELECT setval('boot4_batch_job_instance_seq', 101, true);
SELECT setval('boot4_batch_job_execution_seq', 101, true);
SELECT setval('boot4_batch_step_execution_seq', 101, true);
