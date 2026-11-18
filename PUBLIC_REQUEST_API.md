# Public blood request contract

GET `/api/v1/blood-requests` and GET `/api/v1/blood-requests/:id` are anonymous reads.
The list retains `data.meta` (page, limit, total, totalPages) and `data.result`.
Detail retains `data` as a single request. Deleted or missing requests return 404;
malformed UUIDs and malformed list queries return 400 with validation errors.

## Public fields

Both endpoints select only: id, patientName, bloodGroup, unitsNeeded,
unitsFulfilled, hospitalName, hospitalAddress, urgency, status, createdAt,
and updatedAt. Requester accounts, requesterId, assignments, donor profiles,
contactNumber and coordinates are excluded. Existing free-form notes are not
safe public descriptions, so they are excluded too. Authorized workspace
contact/assignment data is scheduled for checkpoint 4-BE.

This deliberately removes fields previously exposed by these public endpoints.
The cache namespace is `cache:blood-requests:public-v2:`; existing wildcard
invalidation still applies and old cached responses are never reused.

## List query parameters

- page: decimal positive integer, 1–1,000,000; default 1.
- limit: decimal positive integer, 1–100; default 10.
- searchTerm: trimmed text up to 200 characters.
- bloodGroup, urgency, status: exact backend enum values.
- sortBy: createdAt, updatedAt, urgency or unitsNeeded; default createdAt.
- sortOrder: asc or desc; default desc. IDs break ties in ascending order.

Unknown keys, repeated values, objects, invalid enums, and invalid numeric
strings return 400 before database access. URL-encode query values normally.

## Verification and manual checks

From `server/`, run `npm test`, `npx tsc --noEmit`, and `npm run build`.
The test uses actual Express controllers/services with isolated database/cache
substitutes; it verifies projections, cached responses, query rejection and
missing IDs. It creates no records in the development database. Redis is
closed after the test so its retry loop does not keep the runner open.

With the development server running on port 13034:

1. GET `http://localhost:13034/api/v1/blood-requests?limit=2`: expect 200,
   pagination metadata, at most two records, and only the public fields above.
2. Copy a returned ID and GET `/api/v1/blood-requests/<id>`: expect the same
   public field set, without accounts, contact details or assignments.
3. Try `?page=0`, `?limit=101`, `?sortBy=password`, `?bloodGroup=BAD`,
   and `?page=1&page=2`: each must return 400.
4. GET a valid UUID that does not exist: expect 404.

Checkpoint evidence: the live local backend returned 200 with nine list records,
matching detail fields, and 400 for malformed page/limit/enum/sort queries.
Automated contract tests, TypeScript and the backend build passed. The existing
CJS build warns about Prisma's `import.meta`; the ESM `dist/server.js` is the
configured start target. This checkpoint has no frontend changes.
