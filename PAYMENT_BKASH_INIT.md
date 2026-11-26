# bKash checkout initiation (7-BE1)

Hardens the existing `POST /api/v1/payments/bkash/create`. The callback flow is reworked in 7-BE2 and is unchanged here, except that a gateway failure while executing now answers 502 instead of fabricating success.

## Request
`POST /api/v1/payments/bkash/create` — roles `RECIPIENT`, `ADMIN`.

Headers: `Idempotency-Key: <16-64 chars of A-Z a-z 0-9 _ ->` (required, scoped per payer).
Body (strict): `{ "requestId": "<uuid>", "amount": "150.50" }`. `amount` may be a string or number; it must be BDT with at most two decimals, 10.00 to 500,000.00. Extra fields such as `payerId` or `status` are rejected (400). The payer is always the authenticated user.

## Behaviour
| Case | Result |
| --- | --- |
| New attempt | 201 `{ payment, bkashURL }` |
| Same key and same request/amount | 200, same attempt and URL, no second gateway call |
| Same key, different request or amount | 422 |
| Missing/invalid key, bad amount, unknown fields | 400 |
| Request not found / cancelled | 404 / 400 |
| bKash credentials not configured | 503, nothing stored |
| Gateway declined, unreachable, non-JSON, HTTP error or untrusted URL | 502 generic message; attempt stored as `FAILED` with an audit entry; use a new key to retry |

The attempt is stored `PENDING` (placeholder `paymentId` `PENDING-<hex>`, unique `merchantInvoiceNumber`) before bKash is called; bKash's `paymentID` and checkout URL are stored afterwards. A request arriving while another with the same key is still creating the checkout replays the attempt with `bkashURL: null` and status `PENDING`; retry shortly.

`payment` is a minimal summary: `id, requestId, status, paymentMethod, currency, amount ("150.50"), paymentId, createdAt`. Responses are `no-store`.

## No simulated success
`bkash.client.ts` no longer falls back to mock tokens, payments or executions. Any gateway failure throws. Hardcoded sandbox credentials were removed from `config`; set `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` (see `.env.example`). Checkout URLs must be on `*.bka.sh`, `*.bkash.com` or the configured gateway host.

## Schema
Migration `20261126090000_payment_hardening_fields` is additive: `amountMinor` (poisha, backfilled from the legacy float `amount`, which stays), `currency` (`BDT`), `merchantInvoiceNumber` (unique), `checkoutUrl`, `idempotencyKey` + `initiationFingerprint` (unique per payer), `failureReason`, and an index on `requestId`. `GET /payments/:id` still returns every legacy field and omits `idempotencyKey`, `initiationFingerprint` and `checkoutUrl`.

Migration history: the only older migration creates just `patients` and `users`, so `prisma migrate deploy` on an empty database fails at `ALTER TABLE "payments"`. Existing databases built with `prisma db push` can apply this SQL once; baseline the history before relying on `migrate deploy`.

## Verification
`npm test` (`tests/bkash-init.test.js`): amount bounds and float noise, strict body, key rules, payer binding, stored-before-gateway, replay and mismatch, concurrent duplicates, every gateway failure mode, outage, unconfigured, detail omission and legacy reads. `scripts/verify-payment-migration.mjs` checks the backfill on in-memory Postgres.

Not verified here: a real bKash sandbox checkout (needs credentials) and the migration on a real database.
