# Stripe Checkout initiation, test mode (7-BE1)

Replaces the bKash checkout (its sandbox rejects every callback URL). The webhook that completes payments arrives in 7-BE2; until then a created Checkout stays `PENDING`.

## Setup
1. Create a free Stripe account and copy the **test-mode** secret key (`sk_test_...`) from the Dashboard.
2. Set in `server/.env`: `STRIPE_SECRET_KEY`, `FRONTEND_URL` (used for the return pages), optional `STRIPE_CURRENCY` (default `bdt`). `STRIPE_WEBHOOK_SECRET` is used from 7-BE2.
3. Live keys (`sk_live_`, `rk_live_`) are refused: initiation answers 503. Missing key or `FRONTEND_URL` also answers 503 and stores nothing.

If Stripe rejects BDT for your account, set `STRIPE_CURRENCY` to a supported currency (for example `usd`) and note it in the docs. A too-small amount returns 400 with a "below the minimum" message.

## Request
`POST /api/v1/payments/stripe/checkout`, roles `RECIPIENT`, `ADMIN`.
Headers: `Idempotency-Key: <16-64 chars of A-Z a-z 0-9 _ ->` (required, per payer).
Body (strict): `{ "requestId": "<uuid>", "amount": "150.50" }`. Amount is BDT-style text with at most two decimals, 10.00 to 500,000.00 (the same value is sent to Stripe in minor units). `payerId`, `status`, `currency` and any other field return 400.

## Behaviour
| Case | Result |
| --- | --- |
| New attempt | 201 `{ payment, checkoutUrl }` |
| Same key and same request/amount | 200, same attempt and URL, no second Stripe call |
| Same key, different request or amount | 422 |
| Missing/invalid key, amount or body | 400 |
| Request not found / cancelled | 404 / 400 |
| No test key, live key or no `FRONTEND_URL` | 503, nothing stored |
| Amount below Stripe's minimum | 400, attempt stored `FAILED` |
| Stripe declined, unreachable, non-JSON, incomplete or untrusted URL | 502 generic message; attempt `FAILED` with an audit entry; use a new key to retry |

The attempt is stored `PENDING` (placeholder `paymentId` `PENDING-<hex>`, unique `merchantInvoiceNumber`) before Stripe is called; the Checkout Session ID then replaces `paymentId` and the Checkout URL is stored. The Checkout is created with `client_reference_id` = payment record ID, `success_url` = `FRONTEND_URL/payment/success?payment=<id>` and `cancel_url` = `.../payment/cancel?payment=<id>` (record ID only, never a status). The client's idempotency key is also sent to Stripe. The checkout address must be on `checkout.stripe.com`.

`payment` is a minimal summary: `id, requestId, status, paymentMethod ("STRIPE"), currency, amount ("150.50"), paymentId, createdAt`. Responses are `no-store`. `POST /payments/bkash/create` now answers `410 Gone`.

## Schema
Migration `20261126120000_payment_stripe_support` (additive): adds `STRIPE` to `PaymentMethod` and a `payment_webhook_events` table (unique Stripe event ID, used from 7-BE2). It builds on `20261126090000_payment_hardening_fields` (exact amount, idempotency key, fingerprint, invoice number, failure reason). Existing bKash rows and `GET /payments/:id` reads are unchanged. Apply once with `npx prisma db execute --file prisma/migrations/20261126120000_payment_stripe_support/migration.sql` (from `server/`); the same migration-history caveat as before applies (the older migration does not create `payments`).

## Test cards
`4242 4242 4242 4242` succeeds, `4000 0000 0000 9995` is declined, `4000 0025 0000 3155` requires 3-D Secure; any future expiry, any CVC.

## Verification
`npm test` (`tests/stripe-checkout.test.js`, with a local stand-in Stripe API via `STRIPE_API_BASE_URL`): amount bounds, strict body, key rules, payer binding, stored-before-Stripe, exact amount/currency/return URLs sent, replay and mismatch, concurrent duplicates, every failure mode, minimum amount, unreachable, test-key enforcement, retired bKash route, detail omission and legacy reads. `scripts/verify-stripe-migration.mjs` checks the migration on in-memory Postgres.

Not verified here: a real Stripe Checkout (no test key was available) and the migration on a real database.
