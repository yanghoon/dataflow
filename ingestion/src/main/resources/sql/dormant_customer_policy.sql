SELECT 
    customer_id, 
    CAST(subscription_date AS VARCHAR) AS subscription_date, 
    email
FROM customers 
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM customers)
  AND (subscription_date <= CAST(:cutoffDate AS DATE) OR subscription_date IS NULL)
