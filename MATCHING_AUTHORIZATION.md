# Matching authorization — 4-BE.3

`GET /api/v1/blood-requests/:id/matching-donors` now requires the current request
owner (Recipient) or an active Admin. Existing authentication still rejects
anonymous/invalid sessions (401) and donors/blocked accounts (403).

Every service call reads the current non-deleted request and checks ownership
before calling the cache or querying donor profiles. Unrelated recipients and
missing/deleted requests receive the same 404. Malformed UUIDs return 400.
The controller passes only the verified session identity/role to the service.
Responses set `Cache-Control: private, no-store`.

Matching rules, distance filtering, response fields, cache keys and TTL remain
compatible. Authorized owner/admin calls can still reuse matches. Current
ownership and deletion are rechecked even when cached data exists. No schema
migration is needed. This endpoint contains private donor coordination data;
it is never a public discovery endpoint.

## Verification

TypeScript, all four backend contract tests and the backend build passed. The
existing CJS Prisma import.meta warning remains; the configured ESM output builds.
The new HTTP test verifies cold and warm denials, owner/admin cache hits, no
donor/cache reads for unrelated users, verified DB roles rather than token role
claims, malformed IDs, ownership change and deletion with a stale cache present.

`npx tsx scripts/check-matching-authorization.ts` passed against the running
backend: owner read, unrelated recipient denial, repeated owner and admin reads.
The script uses existing database records and short-lived locally signed test
tokens; it does not test password login or modify records. Set
`OWNED_TEST_API_URL` to override the local backend. Controlled tests explicitly
assert cache hits; the live check verifies observable access and response behavior.

## Manual Postman check

1. Start the backend (`npm run dev` in `server/`) and re-import the collection.
   Set `requestId` to an existing non-deleted request owned by the logged-in
   recipient. Do not use the ID after running the earlier soft-delete request.
2. Run matching request 14 with `recipientAccessToken`: expect 200. Repeat to
   exercise warm-cache access. Request 14c with `adminAccessToken` also returns 200.
3. Log in as a different active recipient and put that token into the new
   `otherRecipientAccessToken` variable. Run 14d with the same requestId: expect
   404 and no donor data. Do not overwrite the owner token.
4. Repeat request 14 as the owner: expect 200. A malformed UUID returns 400;
   nonexistent/already-deleted IDs return 404. No destructive setup is necessary.

Changed files relative to `server/`: donation controller/service,
`tests/matching-authorization.test.js`, `scripts/check-matching-authorization.ts`,
`postman/blood-donation-platform.postman_collection.json`, and this document.

User manual testing and backend commit: pending.
Suggested commit in `server/`: `fix: enforce matching ownership before cache access`.
Next: 4A.1 — Recipient overview and summary API integration (frontend).
