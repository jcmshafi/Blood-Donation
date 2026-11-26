# bKash callback verification (7-BE2)

`GET|POST /api/v1/payments/bkash/callback?paymentID=<id>&status=<success|cancel|failure>` (public, called by bKash via the browser).

## Trust model
The `status` parameter is only a hint for which gateway check to run. Stored payment status changes only after bKash confirms the outcome server-to-server, and only while the payment is `PENDING`.

| Stored state | Browser hint | What happens |
| --- | --- | --- |
| COMPLETED / CANCELLED / FAILED | any | Nothing changes, bKash is not called; the existing outcome is returned (a late cancel or failure cannot overwrite COMPLETED) |
| PENDING | `success` | bKash **execute**; the response must match the stored attempt (payment ID, `trxID` present, status `Completed`, currency, amount to the poisha) → COMPLETED once, with one audit entry (`PAYMENT_COMPLETED`) and one receipt email. A mismatch → FAILED with `PAYMENT_VERIFICATION_FAILED` and no completion |
| PENDING | `success`, execute declined | bKash **status query**; `Completed` is verified like above; `Cancelled` / `Failed` / `Expired` settle accordingly; anything else stays PENDING |
| PENDING | `cancel` / `failure` / none | bKash **status query** only: `Cancelled` → CANCELLED, `Failed`/`Expired` → FAILED, `Completed` → verified completion, still `Initiated` → stays PENDING (a forged cancel cannot cancel) |
| PENDING | bKash unreachable | Stays PENDING; no completion is ever fabricated |

Completion uses a conditional update (`WHERE status = PENDING`), so concurrent or repeated callbacks produce exactly one completion, audit entry and receipt.

## Response
- `GET` (the browser return): `302` to `FRONTEND_URL` + `/payment/success|cancel|failure?payment=<record id>`. The page is chosen from the **stored** outcome; a still-pending payment uses the browser hint's page, which only reads backend state. Only a record reference is in the URL, never a status. Unknown payment → `/payment/failure`. Without `FRONTEND_URL` the callback answers JSON.
- `POST` (API callers): `200 { outcome, payment }` where `payment` is `id, requestId, status, paymentMethod, currency, amount, paymentId, createdAt, transactionId, failureReason`. Unknown payment → 404, missing or oversize `paymentID` → 400.
- All callback responses are `no-store`.

## Payment detail
`GET /payments/:id` (payer or admin) no longer returns `paymentExecuteResponse`, `idempotencyKey`, `initiationFingerprint` or `checkoutUrl`. Legacy fields are unchanged.

## Not verified here
Run against the real bKash sandbox before ticking 7.3/7.4. In particular confirm the status strings bKash returns from the query API after a user cancels or fails (the code recognises `Cancelled`, `Failed`, `Expired`, `Completed`; `Initiated` is treated as unconfirmed). A user who cancels may leave the attempt PENDING if the sandbox keeps reporting `Initiated`.
