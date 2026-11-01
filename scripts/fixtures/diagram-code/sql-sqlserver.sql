CREATE SCHEMA [sales]
GO

CREATE TABLE [sales].[customer] (
  [id] BIGINT IDENTITY(1,1) NOT NULL,
  [email] NVARCHAR(200) NOT NULL,
  CONSTRAINT [pk_customer] PRIMARY KEY ([id]),
  CONSTRAINT [uq_customer_email] UNIQUE ([email]),
  CONSTRAINT [ck_customer_email] CHECK (LEN([email]) > 2)
)
GO

CREATE TABLE [sales].[orders] (
  [id] BIGINT NOT NULL PRIMARY KEY,
  [customer_id] BIGINT NOT NULL,
  CONSTRAINT [fk_orders_customer] FOREIGN KEY ([customer_id]) REFERENCES [sales].[customer] ([id])
)
GO

CREATE UNIQUE INDEX [idx_orders_customer] ON [sales].[orders] ([customer_id] DESC)
GO

CREATE VIEW [sales].[customer_names] AS
SELECT [email] AS [customer_email] FROM [sales].[customer]
GO
