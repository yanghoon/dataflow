-- Select and Insert from 'customer_csv_fdw' to 'customers' with 'fdw' system_id

INSERT INTO customers (
    snapshot_date, systemId, index_id, customer_id, first_name, last_name,
    company, city, country, phone_1, phone_2, email, subscription_date, website
)
SELECT 
    CAST(:snapshotDate AS DATE), :systemId, c.*
FROM :tableName c;
