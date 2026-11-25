# Admin list APIs (6-BE)

`GET /api/v1/admin/users` and `GET /api/v1/admin/audit-logs`. ADMIN role only (401 without a valid token, 403 for
other roles or blocked accounts). Responses carry `Cache-Control: private, no-store`.

Queries are parsed strictly from `req.query` (`admin.query.ts`). Unknown keys, repeated values, malformed numbers and
values outside the lists below return **400** before any database access.

## Common parameters
| Param | Rule | Default |
| --- | --- | --- |
| `page` | integer 1..1,000,000 | 1 |
| `limit` | integer 1..100 | users 10, audit logs 20 |
| `sortOrder` | `asc` or `desc` | `desc` |

Ordering always adds `id asc` as a tie-breaker so pages never overlap or skip rows.

## `/admin/users`
| Param | Rule |
| --- | --- |
| `sortBy` | `createdAt` (default), `updatedAt`, `name`, `email`, `role`, `status` |
| `role` | `DONOR`, `RECIPIENT`, `ADMIN` |
| `status` | `ACTIVE`, `BLOCKED` |
| `searchTerm` | trimmed, 1..100 characters; case-insensitive match on name, email, phone, address |

## `/admin/audit-logs`
| Param | Rule |
| --- | --- |
| `sortBy` | `createdAt` (default), `action`, `resource` |
| `action` | trimmed, 1..100 characters; case-insensitive contains |
| `resource` | trimmed, 1..100 characters; case-insensitive contains |

## Response (unchanged)
`{ meta: { page, limit, total, totalPages }, result: [...] }`. Users omit `password`; audit logs include a reduced
`user` (`id`, `name`, `email`, `role`).

## Behaviour changes
- **Before:** `sortBy` was any string used as a Prisma field name (including `password` or relation names), `limit` had
  no upper bound, and non-numeric `page`/`limit` fell through to `NaN`.
- **Now:** `sortBy` is an allow-list per endpoint, `limit` is capped at 100, invalid numbers are 400s, and empty
  `searchTerm`/`action`/`resource` values are rejected (omit the parameter instead).
- `PATCH /admin/users/:id/status` and `GET /admin/dashboard-stats` are unchanged.

## Tests
`tests/admin-lists.test.js` (mocked Prisma and JWT): auth for both endpoints, 40+ invalid queries rejected with no
database call, defaults, pagination offsets, every allowed sort field reaching Prisma only as a typed `orderBy`,
filters, trimmed search, password never selected, audit-log allow-list (e.g. `userId`, `details` rejected).
Run with `npm test` (6/6 pass) and `npm run build`.

## Limitations
Not exercised against a real database; ordering by `role`/`status` sorts by enum declaration order in PostgreSQL.
