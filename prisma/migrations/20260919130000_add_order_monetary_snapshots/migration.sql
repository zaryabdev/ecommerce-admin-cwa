-- Immutable monetary snapshots. Nullable columns preserve legacy rows whose
-- historical prices cannot be reconstructed safely from mutable Product.price.
ALTER TABLE "Order" ADD COLUMN "subtotal" DECIMAL;
ALTER TABLE "Order" ADD COLUMN "total" DECIMAL;
ALTER TABLE "Order" ADD COLUMN "currency" TEXT;

ALTER TABLE "OrderItem" ADD COLUMN "unitPrice" DECIMAL;
ALTER TABLE "OrderItem" ADD COLUMN "lineTotal" DECIMAL;
