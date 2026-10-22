# Production Deployment & Architecture Guide
## Blood Donation & Emergency Assistance Platform Backend

This document contains full instructions for running, testing, and deploying the **Blood Donation & Emergency Assistance Platform Backend**.

---

## 1. Quick Start (Local Development)

### Prerequisites
- Node.js 20+ or Bun 1.3+
- PostgreSQL database (Local or Cloud e.g. Neon, Supabase, AWS RDS)
- Redis (Optional; the application automatically falls back to an in-memory cache if Redis is not running)

### Setup Steps
```bash
# 1. Install dependencies
bun install   # or npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Generate Prisma Client
npx prisma generate

# 4. Seed demo admin and test users
bun run prisma/seed.ts   # or npx tsx prisma/seed.ts

# 5. Start development server
npm run dev
```
The server will start at `http://localhost:5000`.

---

## 2. Pre-Seeded Demo Credentials

The database seed script provisions three active accounts with distinct RBAC roles:

| Role | Email | Password | Description |
|---|---|---|---|
| **ADMIN** | `admin@bloodemergency.org` | `Admin@123456` | Full moderation, dashboard statistics, audit log access |
| **DONOR** | `donor@bloodemergency.org` | `Donor@123456` | Pre-configured `O_POSITIVE` donor with location and availability |
| **RECIPIENT** | `recipient@bloodemergency.org` | `Recipient@123456` | Patient/requester role capable of creating emergency blood requests |

---

## 3. Environment Variables Reference

| Variable | Required | Default / Example | Purpose |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` / `production` | Environment mode |
| `PORT` | No | `5000` | HTTP port |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db?sslmode=require` | PostgreSQL connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection (falls back to memory if absent) |
| `JWT_ACCESS_SECRET` | Yes | `super_secret_access_key_123` | JWT Access Token signing key |
| `JWT_REFRESH_SECRET` | Yes | `super_secret_refresh_key_123` | JWT Refresh Token signing key |
| `JWT_ACCESS_EXPIRES_IN` | No | `1d` | Access token lifespan |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifespan |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Password hashing complexity |
| `BKASH_APP_KEY` | Yes | `4f6o0cjiki2rfm34kfdadl1eqq` | Real bKash Sandbox App Key |
| `BKASH_APP_SECRET` | Yes | `2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b` | Real bKash Sandbox App Secret |
| `BKASH_USERNAME` | Yes | `sandboxTokenizedUser02` | Real bKash Sandbox Username |
| `BKASH_PASSWORD` | Yes | `sandboxTokenizedUser02@12345` | Real bKash Sandbox Password |
| `BKASH_BASE_URL` | Yes | `https://tokenized.sandbox.bka.sh/v1.2.0-beta` | bKash Tokenized Checkout Sandbox API |
| `BKASH_CALLBACK_URL`| Yes | `http://localhost:5000/api/v1/payments/bkash/callback` | Public callback receiver URL |

---

## 4. Single Unified Postman Collection

The repository contains **one single unified Postman collection**:
📁 `postman/blood-donation-platform.postman_collection.json`

### Folder & Phase Structure (24 Endpoints Total)

1. **Phase 1 - Auth & RBAC**:
   - `1. Register Donor / Recipient` (POST `/api/v1/auth/register`)
   - `2. Login Admin` (POST `/api/v1/auth/login` $\to$ sets `{{adminAccessToken}}`)
   - `3. Login Donor` (POST `/api/v1/auth/login` $\to$ sets `{{donorAccessToken}}`, `{{donorUserId}}`)
   - `4. Login Recipient` (POST `/api/v1/auth/login` $\to$ sets `{{recipientAccessToken}}`, `{{recipientUserId}}`)
   - `5. Refresh Token` (POST `/api/v1/auth/refresh-token`)
   - `5b. Logout` (POST `/api/v1/auth/logout`)

2. **Phase 2 - User & Donor Profiles**:
   - `6. Get My Profile` (GET `/api/v1/users/me`)
   - `7. Update My Profile` (PATCH `/api/v1/users/me`)
   - `8. Update Donor Profile` (PATCH `/api/v1/users/donor-profile`)
   - `8b. RBAC Forbidden Check` (PATCH `/api/v1/users/donor-profile` with Recipient token $\to$ `403`)

3. **Phase 3 - Emergency Blood Requests**:
   - `9. Create Emergency Blood Request` (POST `/api/v1/blood-requests` $\to$ sets `{{requestId}}`)
   - `10. List Blood Requests with Filters & Pagination` (GET `/api/v1/blood-requests`)
   - `11. Get Blood Request By ID` (GET `/api/v1/blood-requests/{{requestId}}`)
   - `12. Update Blood Request` (PATCH `/api/v1/blood-requests/{{requestId}}`)
   - `13. Soft Delete Blood Request` (DELETE `/api/v1/blood-requests/{{requestId}}`)

4. **Phase 4 - Matching & Donations**:
   - `14. Find Matching Donors` (GET `/api/v1/blood-requests/{{requestId}}/matching-donors`)
   - `15. Accept Blood Request with Concurrency Lock` (POST `/api/v1/blood-requests/{{requestId}}/accept` $\to$ sets `{{donationId}}`)
   - `16. Update Donation Status (COMPLETED)` (PATCH `/api/v1/donations/{{donationId}}/status`)
   - `17. Donor Donation History & 90-Day Cooldown` (GET `/api/v1/donations/my-history`)

5. **Phase 5 - Real bKash Payments**:
   - `18. Initiate bKash Payment` (POST `/api/v1/payments/bkash/create` $\to$ sets `{{paymentId}}`, returns `bkashURL`)
   - `19. bKash Callback & Execution` (POST `/api/v1/payments/bkash/callback` $\to$ verifies `trxID`, marks `COMPLETED`)
   - `20. Query Payment Record by ID` (GET `/api/v1/payments/{{paymentId}}`)

6. **Phase 6 - Admin Moderation & Analytics**:
   - `21. List All Users with Filtering` (GET `/api/v1/admin/users`)
   - `22. Suspend/Block User Account` (PATCH `/api/v1/admin/users/{{recipientUserId}}/status`)
   - `22b. Restore User Account Status` (PATCH `/api/v1/admin/users/{{recipientUserId}}/status`)
   - `23. Real-Time Platform Analytics Dashboard` (GET `/api/v1/admin/dashboard-stats`)
   - `24. View System Audit Logs` (GET `/api/v1/admin/audit-logs`)
   - `24b. RBAC Forbidden Check for Non-Admin` (GET `/api/v1/admin/dashboard-stats` $\to$ `403`)

---

## 5. Deployment Options

### Option A: Docker & Docker Compose
Run the entire platform (API + PostgreSQL + Redis) with a single command:
```bash
docker-compose up --build -d
```
Check container logs:
```bash
docker-compose logs -f api
```

### Option B: Vercel Serverless
The repository includes `vercel.json`:
1. Push repository to GitHub.
2. Import project in [Vercel](https://vercel.com).
3. Set environment variables (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, etc.).
4. Click **Deploy**.

### Option C: Render / Railway / DigitalOcean VPS
1. Point to Dockerfile or run `npm run build && npm start`.
2. Supply environment variables.
3. Run `npx prisma migrate deploy` on deployment.
