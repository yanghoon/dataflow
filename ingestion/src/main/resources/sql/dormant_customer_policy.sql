SELECT 
    customer_id, 
    CAST(subscription_date AS VARCHAR) AS subscription_date, 
    email
FROM customers 
WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM customers)
  AND (subscription_date <= CURRENT_DATE - CAST(:thresholdDays || ' days' AS INTERVAL) OR subscription_date IS NULL)
