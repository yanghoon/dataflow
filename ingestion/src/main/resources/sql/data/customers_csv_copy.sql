COPY customers_csv (
    index_id, customer_id, first_name, last_name, company, 
    city, country, phone_1, phone_2, email, subscription_date, website
) FROM STDIN WITH (FORMAT CSV, HEADER true);
