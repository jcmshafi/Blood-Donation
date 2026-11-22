# Owned request list — 4-BE.1

`GET /api/v1/blood-requests/mine` requires an active Recipient or Admin session.
Identity comes from the verified database user, never a query parameter. Admins
also receive only their own requests here. Donors/blocked accounts receive 403;
missing/invalid credentials or deleted accounts receive 401. The static route
is registered before `/:id`.

## Contract

Accepts the same strict query allowlist as public discovery: `searchTerm`,
`bloodGroup`, `urgency`, `status`, `page`, `limit`, `sortBy`, `sortOrder`.
Defaults: page 1, limit 10, createdAt descending. Page range 1–1,000,000; limit
1–100. Sort fields: createdAt, updatedAt, urgency, unitsNeeded. ID ascending is
the stable tie breaker. Unknown keys (including requesterId/userId), repeated
values and invalid values return 400 before querying requests.

The success envelope contains:

```json
{
  "success": true,
  "message": "Your blood requests retrieved successfully",
  "data": {
    "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 },
    "result": [],
    "summary": { "total": 0, "open": 0, "matched": 0, "fulfilled": 0, "cancelled": 0 }
  }
}
```

`meta.total` is the filtered owner count. `summary` always counts all that
owner's non-deleted requests, independent of search, filters and page. Empty or
out-of-range pages return an empty result with accurate totals; summary remains.
All three reads share a RepeatableRead transaction. Responses are private,
no-store, and do not use the anonymous Redis cache.

List rows use the explicit safe public field projection documented in
`PUBLIC_REQUEST_API.md`. Contact details, accounts and assignments are unnecessary
for this list. Authorized private detail is the separate next checkpoint 4-BE.2.
Fulfilled counts describe request capacity status, not completed donations.
No database migration is required. Existing public endpoints retain their contract.

## Verification

- `npx tsc --noEmit`, `npm test` (two HTTP contract tests), and `npm run build`
  passed. Existing CJS/Prisma import.meta warning remains; the configured start
  target is the successful ESM output.
- The owned test mounts the real router/auth/controller with controlled database
  and token verification fixtures. It covers two recipients, admin own scope,
  rejected roles/accounts, identity tampering, page/summary independence, excluded
  deleted records, strict queries, safe projection and no shared cache usage.
- `npx tsx scripts/check-owned-requests.ts` passed against the running backend
  and database: two existing active recipients had 12 and 0 non-deleted requests.
  Page data and all summary counts matched direct database reads; filtered page
  totals, owner tampering and anonymous denial passed. No records were changed.
  This local checker signs five-minute test tokens using the local server secret;
  it does not test password login. It requires two existing recipients and never
  creates them. Override the local API via `OWNED_TEST_API_URL` when needed.

## Manual Postman check

Start the backend normally (`npm run dev` in `server/`). Log in through
`POST /api/v1/auth/login` as a recipient and use its access token as Bearer auth.

1. GET `/api/v1/blood-requests/mine?limit=1&page=1`. Verify only that account's
   requests and a global summary, with Cache-Control private, no-store.
2. Repeat with page=2 and with status=OPEN. Results/filtered total may change;
   summary must remain the same. Compare counts with the owner's database rows.
3. Repeat under a second recipient; it must not reveal the first owner's rows.
   An owner without requests receives empty results and zero summary counts.
4. Add `requesterId=<other-user-id>` or `userId=<other-user-id>`: expect 400.
   Try page=0, limit=101 and sortBy=password: expect 400.
5. Remove authentication: expect 401. Use a donor or blocked account: expect 403.
   Admin access must remain scoped to the admin's own records.
6. Check public list/detail still work anonymously. Do not delete records merely
   to exercise empty results.

Changed files relative to `server/`: bloodRequest controller/route plus new
`src/app/module/bloodRequest/bloodRequest.owned.ts`,
`tests/owned-requests.test.js`, `scripts/check-owned-requests.ts`, and this document.
Generated build output is excluded from this source handoff.

User manual test and backend commit: pending.
Suggested commit in `server/`: `feat: add owned request list API`.
This backend commit does not count toward the frontend commit requirement.
Task 4.1 remains unchecked until 4-BE.2 workspace detail is implemented/verified.
