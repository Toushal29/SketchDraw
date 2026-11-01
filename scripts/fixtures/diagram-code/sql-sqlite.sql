CREATE TABLE main.customer (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused'))
);

CREATE TABLE main.orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES main.customer (id)
);

CREATE INDEX main.idx_orders_customer ON main.orders (customer_id) WHERE customer_id > 0;
CREATE INDEX main.idx_customer_email_lower ON main.customer (lower(email));

CREATE VIEW main.active_customers (customer_id, email) AS
SELECT id, email FROM main.customer WHERE status = 'active';
