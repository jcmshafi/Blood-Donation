-- Additive payment hardening. Existing bKash rows stay readable: the legacy
-- "amount" float is untouched, "amountMinor" is backfilled in poisha.

-- AlterTable: add the exact-amount column nullable, backfill, then require it.
ALTER TABLE "payments" ADD COLUMN "amountMinor" INTEGER;
UPDATE "payments" SET "amountMinor" = ROUND("amount"::numeric * 100)::INTEGER;
ALTER TABLE "payments" ALTER COLUMN "amountMinor" SET NOT NULL;

ALTER TABLE "payments"
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BDT',
  ADD COLUMN "merchantInvoiceNumber" TEXT,
  ADD COLUMN "checkoutUrl" TEXT,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "initiationFingerprint" TEXT,
  ADD COLUMN "failureReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_merchantInvoiceNumber_key" ON "payments"("merchantInvoiceNumber");
CREATE UNIQUE INDEX "payments_payerId_idempotencyKey_key" ON "payments"("payerId", "idempotencyKey");
CREATE INDEX "payments_requestId_idx" ON "payments"("requestId");
