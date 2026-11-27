# Stripe webhook, verified completion and cancel (7-BE2)

Completes payments started by `POST /payments/stripe/checkout` (see `PAYMENT_STRIPE_CHECKOUT.md`). The bKash callback and client were removed; `POST /payments/bkash/create` answers `410`.

## Setup
1. `STRIPE_WEBHOOK_SECRET` (`whsec_...`) in `server/.env`. Locally run the Stripe CLI and use the secret it prints:
   ```
   stripe listen --forward-to localhost:5000/api/v1/payments/stripe/webhook
   ```
   When deployed, register `https://<api-host>/api/v1/payments/stripe/webhook` in the Stripe Dashboard (test mode) for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`, and use that endpoint's signing secret.
2. The webhook path is parsed raw in `app.ts` before `express.json()`; Stripe signs the exact bytes, so do not add a JSON parser in front of it.

## `POST /api/v1/payments/stripe/webhook`
Public, but every request must carry a valid `Stripe-Signature` (5 minute tolerance). The signature is verified on the raw body before anything is parsed: missing, wrong, tampered or stale signatures and non-JSON bodies return `400` and change nothing; an unset `STRIPE_WEBHOOK_SECRET` returns `503`. Handled events return `200 { received: true }`; processing errors return `5xx` so Stripe retries.

| Event | Effect (only while the payment is `PENDING`) |
| --- | --- |
| `checkout.session.completed` | If the session is `paid` **and** its session ID, amount and currency match the stored attempt: `COMPLETED` once (payment intent stored as `transactionId`, one `PAYMENT_COMPLETED` audit entry, one receipt email). A mismatch: `FAILED` with `PAYMENT_VERIFICATION_FAILED`. An unpaid session (asynchronous method) changes nothing yet |
| `checkout.session.async_payment_succeeded` | Same as a paid `completed` |
| `checkout.session.async_payment_failed` | `FAILED` |
| `checkout.session.expired` | `FAILED` ("Checkout session expired") |
| anything else | acknowledged and ignored |

- **Idempotent:** processed event IDs are stored (`payment_webhook_events`), and completion is a conditional update (`WHERE status = PENDING`), so replays and concurrent deliveries produce exactly one completion, audit entry and receipt. A settled payment is never changed (a late expired/failed event cannot overwrite `COMPLETED`).
- **Early webhook:** if the event arrives before the session ID was stored on the attempt, it is matched through `client_reference_id` and the session ID is adopted.
- Unknown sessions are acknowledged (and logged), not retried.

## Reconcile on read
`GET /payments/:id` for a `PENDING` Stripe payment retrieves the Checkout Session from Stripe and settles it through the same verification (paid and matching → `COMPLETED`; amount/currency mismatch → `FAILED`; `expired` → `FAILED`; still open → unchanged). A Stripe outage leaves the payment unchanged and the read still succeeds. Settled payments and legacy bKash rows are never sent to Stripe. This keeps a missed or late webhook from stranding a paid payment, and lets local testing work without the Stripe CLI.

## `POST /api/v1/payments/:id/cancel`
Payer or admin (403 otherwise). The payer left Checkout; the backend asks Stripe first: a paid session is completed (never cancelled), an open session is expired at Stripe and the payment becomes `CANCELLED` (`PAYMENT_CANCELLED` audit), an already expired one becomes `FAILED`. A Stripe outage returns `502` and changes nothing; settled payments are returned unchanged. Response `{ outcome, payment }` with `payment` = `id, requestId, status, paymentMethod, currency, amount, paymentId, createdAt, transactionId, failureReason`.

## Receipt email
`paymentReceiptEmailHtml` no longer mentions bKash; it shows the amount, currency and transaction reference.

## Payment detail
`GET /payments/:id` still omits `paymentExecuteResponse`, `idempotencyKey`, `initiationFingerprint` and `checkoutUrl`; legacy fields are unchanged.

## Verification
`tests/stripe-webhook.test.js` (real Stripe SDK signature verification, a stand-in Stripe API for retrieve/expire): bad/missing/tampered/stale signatures, non-JSON, unset secret, completion once, replays, concurrent deliveries, mismatched amount/currency/session, unpaid and async events, expiry, early webhook, unknown sessions, unhandled types, no overwrite of `COMPLETED`, reconcile (paid/open/expired/mismatch/outage/legacy), cancel (open, paid, outage, other payer, signed out, repeat, admin, late webhook after cancel).

Not verified here: real Stripe test-mode events (no test key or webhook secret was available) and the migrations on a real database.
