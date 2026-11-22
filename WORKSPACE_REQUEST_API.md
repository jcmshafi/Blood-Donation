# Authorized request detail — 4-BE.2

`GET /api/v1/blood-requests/:id/workspace` returns private request coordination
data only to the request owner (Recipient) or an active Admin. Authentication
uses the existing verified token and current database account. Donors and blocked
users receive 403; absent/invalid credentials or deleted accounts receive 401.

The query includes `id`, `isDeleted: false` and, for recipients, the verified
`requesterId`. An unrelated recipient, missing request and deleted request all
receive the same 404 response. Private data is never fetched before owner scope
is applied. Admins can read any non-deleted request. Invalid UUIDs and all query
parameters (including forged requesterId/userId) receive 400 after authentication.

The route is registered before `/:id`; `/mine` remains ahead of dynamic routes.
No shared cache is used. Handler responses set `Cache-Control: private, no-store`.
No migration is required.

## Response fields

The normal `{ success, message, data }` envelope contains one request:

- All safe fields documented in `PUBLIC_REQUEST_API.md`.
- `requesterId`, `latitude`, `longitude`, `contactNumber`, nullable `notes`.
- `assignments`, newest first with ID tie breaker: `id`, `donorId`, `status`,
  nullable `notes`/`completedAt`, `createdAt`, `updatedAt` and `donor`.
- Each donor contains only `id`, `name`, nullable `phone` and nullable
  `donorProfile` containing `bloodGroup` and `phone`.

Explicit Prisma selects exclude passwords, Google IDs, email, addresses, donor
coordinates, donation-history/profile fields and payment relations. Request
capacity status and assignment completion remain separate concepts. An empty
assignment array is valid. Anonymous list/detail and `/mine` still use the safe
public projection, without these additional private fields.

## Verification

TypeScript, all three HTTP contract tests, and the backend build passed. The
existing CJS import.meta warning remains; production start uses the ESM output.
Tests cover owner/admin success, unrelated recipient denial after an owner read,
donor/blocked/deleted/anonymous access, malformed IDs, forged identity parameters,
missing/deleted records, private field selection, credential exclusion and no
shared-cache reads. Tests use the real router/auth/controller with controlled
database/token fixtures.

`npx tsx scripts/check-workspace-request.ts` passed against the running backend
and real database for an existing request with one assignment. Owner/admin values
matched database fields, unrelated and anonymous users were denied, forged owner
parameters were rejected, and public detail remained safe. This read-only local
checker uses five-minute signed test tokens, not password login; it requires an
existing owner request, active admin and unrelated recipient. It creates nothing
and prints no credentials/contact data. API override: `OWNED_TEST_API_URL`.

## Manual Postman check

Run `npm run dev` in `server/`. Log in through `/api/v1/auth/login` and use the
returned access token as Bearer auth.

1. As Recipient A, get an ID from `/api/v1/blood-requests/mine`. Call
   `/api/v1/blood-requests/<id>/workspace`: expect 200 with request contact fields
   and assignments, but no account credentials or unrelated donor profile data.
2. Call the same URL as Admin: expect 200. As Recipient B: expect 404 without any
   private fields. As Donor: expect 403. Without credentials: expect 401.
3. As Recipient B append `?requesterId=<recipient-A-id>`: expect 400, never access.
4. As an authorized user try a malformed UUID (400), a nonexistent valid UUID
   (404), and an already-deleted request if available (404). Do not delete shared
   records merely to exercise this check.
5. Verify `/mine` still works and public `/blood-requests/<id>` still excludes
   contact details, coordinates, notes, requesterId and assignments.

Changed files relative to `server/`: bloodRequest controller/route; new
`src/app/module/bloodRequest/bloodRequest.workspace.ts`,
`tests/workspace-requests.test.js`, `scripts/check-workspace-request.ts`,
and this document. Generated build output is excluded from the source handoff.

User manual test and backend commit: pending.
Suggested commit in `server/`: `feat: add authorized request workspace API`.
Task 4.1 is complete after 4-BE.1 and 4-BE.2 implementation/verification.
Next: 4-BE.3 — matching authorization before cache reads.
