CREATE TABLE raw_orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER
);

CREATE OR REPLACE VIEW analytics.staged_orders AS
WITH filtered AS (
  SELECT id, customer_id FROM raw_orders WHERE customer_id IS NOT NULL
)
SELECT id, customer_id FROM filtered;

CREATE TABLE analytics.daily_order_counts AS
SELECT customer_id, COUNT(*) AS order_count
FROM analytics.staged_orders
GROUP BY customer_id;

INSERT INTO analytics.order_audit
SELECT id FROM analytics.staged_orders;
