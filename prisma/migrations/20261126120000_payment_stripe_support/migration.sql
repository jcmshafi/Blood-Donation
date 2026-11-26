-- Additive: Stripe becomes a payment method; processed webhook events are recorded.
-- Existing bKash rows are untouched.
ALTER TYPE "PaymentMethod" ADD VALUE 'STRIPE';

CREATE TABLE "payment_webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);
