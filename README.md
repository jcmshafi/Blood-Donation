# 🩸 Blood Donation & Emergency Assistance Platform — Backend API

[![Deploy on Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel&style=flat-square)](https://blood-donation-one-ecru.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript&style=flat-square)](https://www.typescriptlang.org/)
[![Express.js](https://img.shields.io/badge/Express-5.x-lightgrey?logo=express&style=flat-square)](https://expressjs.com/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-7.x-2D3748?logo=prisma&style=flat-square)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-336791?logo=postgresql&style=flat-square)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis&style=flat-square)](https://redis.io/)
[![bKash Gateway](https://img.shields.io/badge/Payment-bKash_Tokenized-E2136E?style=flat-square)](https://developer.bka.sh/)
[![License](https://img.shields.io/badge/License-ISC-green?style=flat-square)](LICENSE)

A mission-critical, enterprise-ready RESTful backend connecting blood donors with recipients during medical emergencies. Features intelligent **geospatial proximity matching**, strict **ABO blood compatibility logic**, **pessimistic concurrency locking** to eliminate duplicate-acceptance race conditions, an automated **90-day donor cooldown engine**, integrated **bKash Tokenized Checkout** for emergency transport logistics funds, and administrative moderation with immutable audit trails.

---

## 🌐 Live Deployment & Quick Links

- **Production API URL:** [https://blood-donation-one-ecru.vercel.app](https://blood-donation-one-ecru.vercel.app)
- **Health Check & Welcome:** [https://blood-donation-one-ecru.vercel.app/](https://blood-donation-one-ecru.vercel.app/)
- **Unified Postman Collection:** [`postman/blood-donation-platform.postman_collection.json`](./postman/blood-donation-platform.postman_collection.json)
- **Comprehensive API Documentation:** [`postman/POSTMAN_DOCUMENTATION.md`](./postman/POSTMAN_DOCUMENTATION.md)

---

## 🌟 Key Architectural Highlights & Features

### 1. 🔐 Role-Based Access Control (RBAC) & Multi-Provider Auth (Phase 1)
- **Granular Permissions:** Strict role segregation among `DONOR`, `RECIPIENT`, and `ADMIN`.
- **JWT Token Lifecycle:** Short-lived access tokens (`1d`) paired with rotatable refresh tokens (`7d`) delivered via secure, HTTP-only cookies.
- **Google OAuth2 Social Login:** Verifies cryptographic signatures using official `google-auth-library` and provisions user accounts with seamless fallback.
- **Brute-Force Protection:** Dedicated auth rate limiting (10 attempts / 15 minutes) on login and registration endpoints.

### 2. 📍 User & Geolocation Profile Management (Phase 2)
- **Geolocation Coordinates:** Tracks Latitude & Longitude for users and donors to power proximity matching.
- **Donor Sub-Profile:** Decoupled medical metadata, ABO/Rh blood group classification, readiness/availability toggle, and allergy/condition disclosures.
- **Role Safeguards:** Strict middleware constraints prevent recipients from tampering with donor availability state.

### 3. 🚑 Emergency Blood Request Lifecycle (Phase 3)
- **Comprehensive Request Schema:** Captures patient name, hospital address, exact GPS coordinates, required units, urgency levels (`CRITICAL`, `URGENT`, `REGULAR`), and required-by timestamps.
- **Advanced Filtering & Pagination:** Full-text keyword search across hospital and patient fields, combined with multi-attribute filtering (blood group, urgency, status) and dynamic sorting.
- **Non-Destructive Soft Deletion:** Preserves historical clinical data and audit trails while marking `isDeleted: true` and cleanly excluding records from public searches.

### 4. 🩸 Intelligent Matching, Concurrency & 90-Day Cooldown (Phase 4)
- **ABO Compatibility Matrix:** Enforces medically accurate blood compatibility rules (e.g. `O-` universal donor, `AB+` universal recipient, Rh factors).
- **Geospatial Proximity Matching:** Calculates straight-line distance in kilometers using the **Haversine formula** against real-time donor and hospital coordinates.
- **Pessimistic Concurrency Lock:** Wraps acceptance logic in PostgreSQL serializable transactions (`prisma.$transaction`) to prevent two donors from simultaneously claiming the same emergency request (`409 Conflict` on race conditions).
- **Automated 90-Day Cooldown Engine:** Transitioning a donation to `COMPLETED` atomically updates the donor's `lastDonationDate`, flips `isAvailable` to `false`, sets `nextEligibleDate` to `+90 days`, and tracks remaining days until next eligibility.

### 5. 💳 Tokenized bKash Payment Gateway Integration (Phase 5)
- **Emergency Transport Logistics Fund:** Recipient can sponsor ambulance or emergency blood transport fees via bKash.
- **bKash Tokenized Checkout:** Initiates checkout via official bKash APIs, generates merchant invoices, and returns secure gateway redirect URLs.
- **Callback Verification & Webhook:** Securely handles bKash redirects (`/checkout/execute`), captures immutable `trxID` and gateway response, marks payment `COMPLETED`, and writes an audit log.

### 6. 🛡️ Admin Moderation, Audit Trails & Real-Time Dashboard (Phase 6)
- **User Management Directory:** Admin search and status filters across all registered platform users.
- **Account Suspension & Restoration:** Admin ability to toggle status (`ACTIVE` $\leftrightarrow$ `BLOCKED`) with mandatory audit logging and immediate session revocation.
- **Platform Analytics Dashboard:** Real-time metrics including total users by role, donor availability versus cooldown ratios, blood requests grouped by status and urgency, and cumulative bKash transport funds collected.
- **Immutable System Audit Logs:** Chronological record of administrative moderation events, security violations, and payment executions.

### 7. 🚀 Security, Hardening & Serverless Performance (Phase 7)
- **Helmet Security Headers:** Defends against XSS, clickjacking, and MIME-sniffing.
- **Express Rate Limiting:** Global rate limit (100 req / 15 min) and strict auth limit (10 req / 15 min).
- **Zod Schema Validation:** Comprehensive input parsing and sanitization across all request bodies and queries.
- **Redis Cache with In-Memory Fallback:** Caches intensive analytics queries; falls back gracefully to local in-memory storage if Redis is offline.
- **Serverless-Safe Prisma Singleton:** Global client cache (`globalThis.__prisma`) eliminates database connection pool exhaustion across Vercel serverless function invocations.
- **TSUP Bundling:** Powered by esbuild for instantaneous compilation (`~60ms`) and CJS require shimming for ESM compatibility.

---

## 🛠️ Technology Stack

| Domain | Technology | Description |
|---|---|---|
| **Runtime** | [Node.js](https://nodejs.org/) (20+) / [Bun](https://bun.sh/) (1.3+) | High-performance JavaScript execution environment |
| **Framework** | [Express 5](https://expressjs.com/) | Modern Node.js web application framework |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (7.x) | Strict type safety and compilation |
| **ORM & Database** | [Prisma 7](https://www.prisma.io/) & [PostgreSQL](https://www.postgresql.org/) | Type-safe schema migrations and relational storage |
| **Caching** | [IORedis](https://github.com/redis/ioredis) | In-memory key-value cache with internal memory fallback |
| **Payments** | [bKash Tokenized Checkout](https://developer.bka.sh/) | Official Bangladeshi mobile financial services API |
| **Social Auth** | [Google Auth Library](https://github.com/googleapis/google-auth-library-nodejs) | Cryptographic verification of Google OAuth2 ID tokens |
| **Security** | [Helmet](https://helmetjs.github.io/), [bcryptjs](https://github.com/dcodeIO/bcrypt.js), [Zod](https://zod.dev/) | HTTP headers hardening, password hashing, and input validation |
| **Bundling** | [TSUP](https://tsup.egoist.dev/) (esbuild) | Zero-config TypeScript bundler generating production artifacts |
| **Hosting** | [Vercel](https://vercel.com/) | Serverless cloud deployment |

---

## 📋 Prerequisites

Before running the application locally, ensure you have:
- **Node.js** v20+ or **Bun** v1.3+
- **PostgreSQL** v14+ (local instance or cloud database such as Supabase / Neon / Render)
- **Redis** (optional; local or Upstash Redis. An in-memory cache activates automatically if Redis is unavailable)

---

## ⚙️ Environment Variables Configuration

Create a `.env` file in the root directory and configure the following variables:

```env
# Application
NODE_ENV="development"
PORT=5000
APP_URL="http://localhost:5000"
FRONTEND_URL="http://localhost:3000"

# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://postgres:password@localhost:5432/blood_donation_db?schema=public"

# Redis Cache (Optional - in-memory fallback engages if missing)
REDIS_URL="redis://localhost:6379"

# Security & Password Hashing
BCRYPT_SALT_ROUNDS=12

# JWT Authentication
JWT_ACCESS_SECRET="your_super_secret_jwt_access_key_2026"
JWT_REFRESH_SECRET="your_super_secret_jwt_refresh_key_2026"
JWT_ACCESS_EXPIRES_IN="1d"
JWT_REFRESH_EXPIRES_IN="7d"

# Google Social Login
GOOGLE_CLIENT_ID="your-google-oauth-client-id.apps.googleusercontent.com"

# bKash Sandbox Payment Gateway Credentials
BKASH_APP_KEY="your_bkash_app_key"
BKASH_APP_SECRET="your_bkash_app_secret"
BKASH_USERNAME="your_bkash_username"
BKASH_PASSWORD="your_bkash_password"
BKASH_BASE_URL="https://tokenized.sandbox.bka.sh/v1.2.0-beta"
BKASH_CALLBACK_URL="http://localhost:5000/api/v1/payments/bkash/callback"

# Email Notifications (Optional - Nodemailer SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Blood Donation Platform <noreply@bloodemergency.org>"
```

---

## 🚀 Local Development Setup Guide

### 1. Clone the Repository
```bash
git clone https://github.com/jcmshafi/Blood-Donation.git
cd Blood-Donation
```

### 2. Install Dependencies
Using **Bun** (recommended) or **npm**:
```bash
bun install
# or
npm install
```

### 3. Generate Prisma Client
```bash
bunx prisma generate
# or
npx prisma generate
```

### 4. Run Database Migrations
Apply the PostgreSQL relational schema and relations:
```bash
bunx prisma migrate dev --name init
# or
npx prisma migrate dev
```

### 5. Seed Initial Demo Accounts
Seed pre-configured demo users (`ADMIN`, `DONOR`, `RECIPIENT`):
```bash
bun run prisma/seed.ts
```

**Pre-seeded Demo Accounts:**
| Role | Email | Password | Location / Blood Group |
|---|---|---|---|
| **ADMIN** | `admin@bloodemergency.org` | `Admin@123456` | Dhaka HQ |
| **DONOR** | `donor@bloodemergency.org` | `Donor@123456` | Mirpur 10, Dhaka (`O+`) |
| **RECIPIENT** | `recipient@bloodemergency.org` | `Recipient@123456` | Dhanmondi, Dhaka |

### 6. Start Development Server
```bash
bun run dev
# or
npm run dev
```
The server will boot on `http://localhost:5000` with hot-reloading.

---

## 📦 Production Build & Deployment

### Build Locally with TSUP
```bash
bun run build
# or
npm run build
```
Generates production-bundled standalone files in the `dist/` folder:
- `dist/server.js` (ESM bundle with CJS require banner shim)
- `dist/server.js.map` (Source maps)

### Deploying to Vercel
1. Push your repository to GitHub.
2. In the Vercel dashboard, click **Add New Project** and select `Blood-Donation`.
3. In **Settings -> Environment Variables**, add your production database URL and secrets (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `BKASH_*`, etc.).
4. Deploy! Vercel uses `vercel.json` and runs `tsup` via `@vercel/node`.

---

## 📑 API Endpoints Reference

### 🔐 Auth & RBAC (`/api/v1/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Public | Register new `DONOR` or `RECIPIENT` |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user & issue JWT tokens |
| `POST` | `/api/v1/auth/google-login` | Public | Social Login with Google ID token |
| `POST` | `/api/v1/auth/refresh-token` | Public | Exchange refresh token for fresh access token |
| `POST` | `/api/v1/auth/logout` | Public | Clear refresh token cookie & logout |

### 👤 User & Donor Profile (`/api/v1/users`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/users/me` | Authenticated | Fetch current user profile & donor stats |
| `PATCH` | `/api/v1/users/me` | Authenticated | Update user contact info & GPS coordinates |
| `PATCH` | `/api/v1/users/donor-profile` | `DONOR` | Update availability, blood group & medical note |

### 🚑 Emergency Blood Requests (`/api/v1/blood-requests`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/blood-requests` | `RECIPIENT`, `ADMIN` | Create emergency blood request |
| `GET` | `/api/v1/blood-requests` | Public | List requests with pagination, filter & search |
| `GET` | `/api/v1/blood-requests/:id` | Public | Get single blood request details |
| `PATCH` | `/api/v1/blood-requests/:id` | Owner / `ADMIN` | Update blood request details |
| `DELETE` | `/api/v1/blood-requests/:id` | Owner / `ADMIN` | Soft delete blood request |
| `GET` | `/api/v1/blood-requests/:id/matching-donors` | `RECIPIENT`, `ADMIN` | Find matching donors by ABO & Haversine distance |
| `POST` | `/api/v1/blood-requests/:id/accept` | `DONOR` | Accept request (concurrency lock protected) |

### 🩸 Donations & Cooldown (`/api/v1/donations`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `PATCH` | `/api/v1/donations/:id/status` | Donor / Recipient / Admin | Mark `COMPLETED` and trigger 90-day cooldown |
| `GET` | `/api/v1/donations/my-history` | `DONOR` | View personal donation history & cooldown stats |

### 💳 bKash Logistics Payments (`/api/v1/payments`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/v1/payments/bkash/create` | `RECIPIENT`, `ADMIN` | Initiate bKash Tokenized Checkout payment |
| `POST` | `/api/v1/payments/bkash/callback` | Public / Gateway | Handle bKash checkout webhook & execute |
| `GET` | `/api/v1/payments/:id` | Payer / `ADMIN` | Retrieve payment transaction receipt |

### 🛡️ Admin Moderation & Analytics (`/api/v1/admin`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/users` | `ADMIN` | Paginated user directory with role/status filters |
| `PATCH` | `/api/v1/admin/users/:id/status` | `ADMIN` | Suspend (`BLOCKED`) or restore (`ACTIVE`) account |
| `GET` | `/api/v1/admin/dashboard-stats` | `ADMIN` | Real-time platform analytics & operational metrics |
| `GET` | `/api/v1/admin/audit-logs` | `ADMIN` | Inspect system-wide immutable audit trail |

---

## 🧪 Postman Collection & Automated Testing

The complete test suite is available in [`postman/blood-donation-platform.postman_collection.json`](./postman/blood-donation-platform.postman_collection.json).

### Running in Postman
1. **Import** the collection into Postman.
2. Select the collection root and click **Run Collection**.
3. All **38 requests** run in sequence with automated assertions:
   - Dynamic bearer token assignment (`pm.collectionVariables.set`)
   - Automated ID chaining (`donorUserId`, `recipientUserId`, `requestId`, `donationId`, `paymentId`)
   - Role-based forbidden assertions (403 verification)
   - Concurrency conflict test (409 verification)
   - Soft-delete exclusion check (404 verification)

---

## 📂 Project Directory Structure

```text
├── api/                       # (Removed - bundled via TSUP)
├── dist/                      # Production build output
│   ├── server.js              # Standalone ESM production bundle
│   └── server.js.map
├── postman/                   # API test suite & documentation
│   ├── blood-donation-platform.postman_collection.json
│   └── POSTMAN_DOCUMENTATION.md
├── prisma/                    # Database schema & migrations
│   ├── migrations/            # SQL migration history
│   ├── schema/                # Modular Prisma schemas
│   └── seed.ts                # Database seeder script
├── src/
│   ├── app.ts                 # Express app setup, middlewares & routes
│   ├── server.ts              # Server boot & serverless export
│   └── app/
│       ├── config/            # Centralized environment configuration
│       ├── lib/               # Prisma singleton & Redis clients
│       ├── middleware/        # checkAuth, validateRequest, rateLimiter, errorHandler
│       ├── module/            # Feature modules
│       │   ├── admin/         # User moderation, stats, audit logs
│       │   ├── auth/          # Register, login, google-login, refresh-token
│       │   ├── bloodRequest/  # Request CRUD, search, filtering
│       │   ├── donation/      # Matching, acceptance lock, 90-day cooldown
│       │   ├── payment/       # bKash client, checkout create & execute
│       │   └── user/          # User & donor profile management
│       └── utils/             # Haversine distance, email service, response helpers
├── tsup.config.ts             # TSUP esbuild bundler configuration
├── vercel.json                # Vercel serverless deployment specification
├── package.json               # Dependencies & build scripts
└── README.md                  # Project documentation
```

---

## 📜 License

This project is licensed under the **ISC License**. Developed as an industry-standard fullstack fusionist engineering platform.
