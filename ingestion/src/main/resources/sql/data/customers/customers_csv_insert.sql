-- CREATE TABLE IF NOT EXISTS customer_subscriptions_:snapshotDate
-- PARTITION OF customers
-- FOR VALUES FROM (:snapshotDate) TO ('2026-07-26');

INSERT INTO customers (
    snapshot_date, index_id, customer_id, first_name, last_name,
    company, city, country, phone_1, phone_2, email, subscription_date, website
)
SELECT 
    CAST(:snapshotDate AS DATE), c.*
FROM customers_csv c;
