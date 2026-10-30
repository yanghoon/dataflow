SELECT customer_id, name, email, status, last_login_date
FROM customers
WHERE status = :status
  AND last_login_date <= CURRENT_DATE - CAST(:daysSinceLastLogin || ' days' AS INTERVAL)
