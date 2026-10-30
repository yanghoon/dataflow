-- CREATE TABLE IF NOT EXISTS customer_subscriptions_:snapshotDate
-- PARTITION OF customers
-- FOR VALUES FROM (:snapshotDate) TO ('2026-07-26');

INSERT INTO departments (
    snapshot_date, system_id, customer_id, department
)
SELECT 
    CAST(:snapshotDate AS DATE), :systemId, d.*
FROM departments_csv d;
