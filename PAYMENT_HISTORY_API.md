# Payment history (7-BE3)

`GET /api/v1/payments/mine` — roles `RECIPIENT`, `ADMIN`. Registered before `/:id`, so `mine` is never read as a payment id. Responses are `private, no-store`.

## Scope
The list is always the authenticated user's own payments (`payerId` comes from the session). Admins see their own payments here too; an admin can still open any payment by id with `GET /payments/:id`. Donors get 403.

## Query (strict)
| Parameter | Values | Default |
| --- | --- | --- |
| `page` | positive integer | 1 |
| `limit` | 1–50 | 10 |
| `status` | `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED` | all |
| `sortBy` | `createdAt`, `amountMinor`, `status` | `createdAt` |
| `sortOrder` | `asc`, `desc` | `desc` |

Unknown keys (`payerId`, `userId`, `requestId`, ...), repeated or invalid values return 400 before any database query. A page past the end returns an empty `result` with the real `meta`.

## Response
`data: { meta: { page, limit, total, totalPages }, result: [ ... ] }`. Each item: `id, requestId, status, paymentMethod, currency, amount ("150.50"), paymentId, createdAt, transactionId, failureReason, request: { id, bloodGroup, hospitalName }`. It never includes the raw gateway response, idempotency key, fingerprint or checkout URL. Legacy bKash rows are included; their amount comes from the backfilled `amountMinor`.

## Detail access
`GET /payments/:id` is unchanged: payer or admin only (403 otherwise, 401 when signed out); accepts the record id or the bKash `paymentId`.

## Verification
`tests/payment-history.test.js`: access by role, own-only scope with other payers' rows present, paging and last/empty pages, status filter, sort allow-list, legacy rows, tampering and invalid parameters rejected before querying, and cross-payer detail denial. Not run against a real database.
