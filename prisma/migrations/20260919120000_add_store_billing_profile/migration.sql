CREATE TABLE "StoreBillingProfile" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "legalName" TEXT,
    "billingContactName" TEXT,
    "billingEmail" TEXT,
    "billingPhone" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "taxNumber" TEXT,
    "companyRegistrationNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreBillingProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoreBillingProfile_storeId_key" ON "StoreBillingProfile"("storeId");
CREATE INDEX "StoreBillingProfile_storeId_idx" ON "StoreBillingProfile"("storeId");
ALTER TABLE "StoreBillingProfile" ADD CONSTRAINT "StoreBillingProfile_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
