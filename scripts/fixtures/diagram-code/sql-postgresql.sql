CREATE SCHEMA IF NOT EXISTS sales;

CREATE TYPE sales.order_state AS ENUM ('pending', 'paid', 'cancelled');

CREATE TABLE sales.customer (
  id BIGINT PRIMARY KEY,
  email VARCHAR(200) NOT NULL,
  name TEXT,
  CONSTRAINT uq_customer_email UNIQUE (email),
  CONSTRAINT ck_customer_email CHECK (length(email) > 2)
);

CREATE TABLE sales.orders (
  id BIGINT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  state sales.order_state NOT NULL,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES sales.customer (id) ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE UNIQUE INDEX idx_orders_id ON sales.orders USING btree (id DESC) WHERE id > 0;

CREATE VIEW sales.order_summary (order_id, customer_name) AS
SELECT o.id, c.name AS customer_name
FROM sales.orders o
JOIN sales.customer c ON c.id = o.customer_id;
