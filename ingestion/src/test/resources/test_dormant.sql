SELECT 
    customer_id, 
    CAST(subscription_date AS VARCHAR) AS subscription_date, 
    email
FROM customers_csv 
WHERE subscription_date <= CURRENT_DATE - CAST(:thresholdDays || ' days' AS INTERVAL)
   OR subscription_date IS NULL
