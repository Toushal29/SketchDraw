CREATE DATABASE IF NOT EXISTS retail;

CREATE TABLE retail.customer (
  id BIGINT NOT NULL,
  email VARCHAR(200) NOT NULL,
  status ENUM('active', 'paused', 'closed') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_email (email)
);

CREATE TABLE retail.orders (
  id BIGINT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES retail.customer (id),
  KEY idx_orders_customer (customer_id)
);

CREATE TABLE retail.order_line (
  order_id BIGINT NOT NULL,
  line_no INT NOT NULL,
  CONSTRAINT pk_order_line PRIMARY KEY (order_id, line_no),
  CONSTRAINT fk_line_order FOREIGN KEY (order_id) REFERENCES retail.orders (id) ON DELETE CASCADE
);

CREATE VIEW retail.active_customers (customer_id, email) AS
SELECT id, email FROM retail.customer WHERE status = 'active';
