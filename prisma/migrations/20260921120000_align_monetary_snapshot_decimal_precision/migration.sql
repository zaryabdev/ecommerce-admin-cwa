-- Align the monetary snapshot columns with Prisma's default `Decimal` mapping.
-- The previous migration created them as unconstrained DECIMAL, whereas Prisma
-- expects DECIMAL(65,30) (same as Product.price). Widening to a fixed precision
-- is lossless for realistic prices: existing values are prices copied from
-- Product.price (already DECIMAL(65,30)) or products/sums thereof, and legacy
-- rows are NULL.
ALTER TABLE "Order" ALTER COLUMN "subtotal" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "total" SET DATA TYPE DECIMAL(65,30);

ALTER TABLE "OrderItem" ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "lineTotal" SET DATA TYPE DECIMAL(65,30);
