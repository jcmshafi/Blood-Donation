# Donor donation history — 5-BE

`GET /api/v1/donations/my-history` requires an active Donor session. Identity comes
from the verified database user, never a query parameter. Recipients/Admins/blocked
accounts receive 403; missing/invalid credentials or deleted accounts receive 401.

## Query contract

Strict allowlist: `status`, `page`, `limit`, `sortBy`, `sortOrder`.

| Param | Values | Default |
| --- | --- | --- |
| `status` | `ASSIGNED`, `COMPLETED`, `CANCELLED` | all |
| `page` | integer 1–1,000,000 | 1 |
| `limit` | integer 1–100 | 10 |
| `sortBy` | `createdAt`, `updatedAt`, `completedAt` (nulls last) | `createdAt` |
| `sortOrder` | `asc`, `desc` | `desc` |

`id` ascending is the stable tie breaker. Unknown keys (including `donorId`/`userId`),
repeated values and invalid values return 400 before the database is queried.

## Response

```json
{
  "data": {
    "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 },
    "summary": { "totalDonations": 0, "totalAssigned": 0, "totalCompleted": 0,
      "totalCancelled": 0, "totalActive": 0, "isAvailable": false,
      "lastDonationDate": null, "nextEligibleDate": null,
      "isEligibleNow": true, "daysUntilEligible": 0 },
    "donations": []
  }
}
```

- `meta.total` is the filtered count; `donations` is the current page.
- `summary` always counts all of the donor's assignments, independent of `status`, page and limit.
- Out-of-range pages return an empty `donations` array with accurate `meta` and `summary`.
- All reads share one RepeatableRead transaction. Responses are `private, no-store` and bypass Redis.

## Compatibility

`summary` and `donations` keep their previous names and shapes. **Behaviour change:** `donations` was
previously unbounded; it is now paginated (default 10). Clients needing more must page.
