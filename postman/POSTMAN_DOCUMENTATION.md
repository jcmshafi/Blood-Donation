# 🩸 Blood Donation & Emergency Platform — API Documentation

This document provides a comprehensive, production-grade reference for all REST API endpoints available in the **Blood Donation & Emergency Assistance Platform Backend**.

---

## 🚀 Postman Collection Quick Start

The complete, automated test suite is bundled in:
📁 **[`postman/blood-donation-platform.postman_collection.json`](./blood-donation-platform.postman_collection.json)**

### 📥 How to Import
1. Open **Postman** (Desktop or Web).
2. Click **Import** (top left).
3. Drag and drop `postman/blood-donation-platform.postman_collection.json`.

### ⚙️ Environment & Collection Variables
The collection uses dynamic collection variables that automatically chain tokens, IDs, and payment references across requests:

| Variable | Default Value | Description |
|---|---|---|
| `baseUrl` | `http://localhost:5000` | Target API host (switch to `https://blood-donation-one-ecru.vercel.app` for production) |
| `accessToken` | *Auto-set* | Current active Bearer access token |
| `adminAccessToken` | *Auto-set* | Bearer token for `Role: ADMIN` |
| `donorAccessToken` | *Auto-set* | Bearer token for `Role: DONOR` |
| `recipientAccessToken` | *Auto-set* | Bearer token for `Role: RECIPIENT` |
| `donorUserId` | *Auto-set* | Registered donor user UUID |
| `recipientUserId` | *Auto-set* | Registered recipient user UUID |
| `requestId` | *Auto-set* | Active emergency blood request UUID |
| `donationId` | *Auto-set* | Created blood donation assignment UUID |
| `paymentId` | *Auto-set* | Internal payment record UUID |
| `bkashPaymentId` | *Auto-set* | bKash tokenized gateway transaction ID |

---

## 📑 API Endpoints Summary Table

| Phase | Method | Endpoint | Access / Role | Description |
|---|:---:|---|:---:|---|
| **Phase 1** | `GET` | `/` | Public | System Health Check & Welcome info |
| | `POST` | `/api/v1/auth/register` | Public | Register user as `DONOR` or `RECIPIENT` |
| | `POST` | `/api/v1/auth/login` | Public | Authenticate user & issue tokens |
| | `POST` | `/api/v1/auth/google-login` | Public | Social Login with Google ID token |
| | `POST` | `/api/v1/auth/refresh-token` | Public | Rotate and issue fresh access token |
| | `POST` | `/api/v1/auth/logout` | Public | Invalidate session & clear cookies |
| **Phase 2** | `GET` | `/api/v1/users/me` | Authenticated | Retrieve authenticated user profile |
| | `PATCH` | `/api/v1/users/me` | Authenticated | Update user contact & coordinates |
| | `PATCH` | `/api/v1/users/donor-profile` | `DONOR` | Update availability, blood group, medical note |
| **Phase 3** | `POST` | `/api/v1/blood-requests` | `RECIPIENT`, `ADMIN` | Create emergency blood request |
| | `GET` | `/api/v1/blood-requests` | Public | Get paginated, filtered, sorted requests |
| | `GET` | `/api/v1/blood-requests/:id` | Public | Get single blood request details |
| | `PATCH` | `/api/v1/blood-requests/:id` | Owner / `ADMIN` | Update blood request details |
| | `DELETE` | `/api/v1/blood-requests/:id` | Owner / `ADMIN` | Soft delete blood request (`isDeleted: true`) |
| **Phase 4** | `GET` | `/api/v1/blood-requests/:id/matching-donors` | `RECIPIENT`, `ADMIN` | Find compatible donors (ABO + Haversine distance) |
| | `POST` | `/api/v1/blood-requests/:id/accept` | `DONOR` | Accept request (pessimistic concurrency lock) |
| | `PATCH` | `/api/v1/donations/:id/status` | Donor / Recipient / Admin | Mark `COMPLETED` & start 90-day cooldown |
| | `GET` | `/api/v1/donations/my-history` | `DONOR` | Get personal donation history & cooldown stats |
| **Phase 5** | `POST` | `/api/v1/payments/bkash/create` | `RECIPIENT`, `ADMIN` | Create bKash tokenized payment for logistics |
| | `POST` | `/api/v1/payments/bkash/callback` | Public / Webhook | Execute bKash transaction on callback |
| | `GET` | `/api/v1/payments/:id` | Payer / `ADMIN` | Retrieve transaction receipt and status |
| **Phase 6** | `GET` | `/api/v1/admin/users` | `ADMIN` | Paginated user management directory |
| | `PATCH` | `/api/v1/admin/users/:id/status` | `ADMIN` | Suspend (`BLOCKED`) or restore (`ACTIVE`) user |
| | `GET` | `/api/v1/admin/dashboard-stats` | `ADMIN` | Real-time platform analytics & metrics |
| | `GET` | `/api/v1/admin/audit-logs` | `ADMIN` | Paginated system audit trails |

---

## 🔒 Detailed Endpoint Specifications

### 🏷️ Phase 1 — Authentication & RBAC

#### 1. Register as DONOR
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/v1/auth/register`
- **Access:** Public
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "name": "Tanvir Hasan",
  "email": "tanvir.donor@example.com",
  "password": "Password@123",
  "role": "DONOR",
  "phone": "+8801712345678",
  "address": "Mirpur 10, Dhaka",
  "bloodGroup": "O_POSITIVE",
  "latitude": 23.8071,
  "longitude": 90.3686
}
```
- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "e4a5d3f2-1234-4567-89ab-cdef01234567",
      "name": "Tanvir Hasan",
      "email": "tanvir.donor@example.com",
      "role": "DONOR",
      "phone": "+8801712345678",
      "donorProfile": {
        "bloodGroup": "O_POSITIVE",
        "isAvailable": true,
        "totalDonations": 0
      }
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

#### 2. User Login
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/v1/auth/login`
- **Access:** Public
- **Request Body:**
```json
{
  "email": "tanvir.donor@example.com",
  "password": "Password@123"
}
```
- **Success Response (`200 OK`):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User logged in successfully",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "user": {
      "id": "e4a5d3f2-...",
      "name": "Tanvir Hasan",
      "email": "tanvir.donor@example.com",
      "role": "DONOR"
    }
  }
}
```

#### 3. GCP Google Social Login
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/v1/auth/google-login`
- **Access:** Public
- **Request Body:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}
```
- **Behavior:** Verifies cryptographic signature using `google-auth-library`. Provisions account automatically if first-time sign-in.

---

### 👤 Phase 2 — User & Donor Profile Management

#### 1. Get Current User Profile
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/users/me`
- **Access:** `Bearer Token (Any Role)`
- **Success Response (`200 OK`):** Returns authenticated user's contact information, GPS coordinates, and linked Donor Profile (including 90-day cooldown status and lifetime donation count).

#### 2. Update Donor Profile
- **Method:** `PATCH`
- **URL:** `{{baseUrl}}/api/v1/users/donor-profile`
- **Access:** `Bearer Token (DONOR strictly required)`
- **Request Body:**
```json
{
  "bloodGroup": "O_POSITIVE",
  "isAvailable": true,
  "medicalConditions": "Eligible to donate, no chronic illnesses"
}
```

---

### 🚑 Phase 3 — Emergency Blood Request Lifecycle

#### 1. Create Emergency Blood Request
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/v1/blood-requests`
- **Access:** `Bearer Token (RECIPIENT or ADMIN)`
- **Request Body:**
```json
{
  "patientName": "Rafiqul Islam",
  "hospitalName": "Dhaka Medical College Hospital",
  "hospitalAddress": "Secretariate Rd, Dhaka 1000",
  "bloodGroup": "B_POSITIVE",
  "units": 2,
  "urgency": "CRITICAL",
  "neededBy": "2026-10-25T14:00:00.000Z",
  "latitude": 23.7258,
  "longitude": 90.3976,
  "contactNumber": "+8801811223344",
  "notes": "Emergency surgery scheduled. Immediate blood donors needed."
}
```
- **Success Response (`201 Created`):** Returns created request with status `PENDING`.

#### 2. Advanced Multi-Criteria Filtering & Pagination
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/blood-requests?page=1&limit=10&bloodGroup=B_POSITIVE&urgency=CRITICAL&sortBy=createdAt&sortOrder=desc`
- **Access:** Public
- **Features:**
  - Multi-field keyword search across `patientName`, `hospitalName`, and `hospitalAddress` via `?searchTerm=Dhaka`
  - Filters: `bloodGroup`, `urgency`, `status`
  - Sorting: `sortBy=neededBy&sortOrder=asc`
  - Automatically excludes soft-deleted records (`isDeleted: true`)

---

### 🩸 Phase 4 — Intelligent Matching, Concurrency & Donation Workflow

#### 1. Match Compatible Donors by Proximity & ABO Rules
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/blood-requests/:id/matching-donors?maxDistanceKm=10`
- **Access:** `Bearer Token (RECIPIENT or ADMIN)`
- **ABO Compatibility Matrix:**
  - `O-` can donate to **ALL** blood groups (Universal Donor).
  - `AB+` can receive from **ALL** blood groups (Universal Recipient).
  - Rh-Negative blood can be received by Rh-Positive patients of matching letter group.
- **Geospatial Proximity:** Calculates straight-line distance in kilometers using the Haversine formula against hospital GPS coordinates.
- **Automatic Cooldown Exclusion:** Donors with an active donation within the last 90 days are automatically filtered out.

#### 2. Accept Blood Request (Concurrency Lock)
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/v1/blood-requests/:id/accept`
- **Access:** `Bearer Token (DONOR)`
- **Concurrency Protection:** Uses PostgreSQL row-level locks within a transaction (`prisma.$transaction`) to guarantee that two donors accepting the same request concurrently cannot double-allocate units.
- **Race Condition Result:** The second donor receives `409 Conflict` ("Request has already been fulfilled or accepted").

#### 3. Complete Donation & Trigger 90-Day Cooldown
- **Method:** `PATCH`
- **URL:** `{{baseUrl}}/api/v1/donations/:id/status`
- **Access:** `Bearer Token (DONOR, RECIPIENT, ADMIN)`
- **Request Body:**
```json
{
  "status": "COMPLETED",
  "unitsDonated": 1,
  "notes": "Donated 1 unit at blood bank successfully."
}
```
- **Automated Actions:**
  - Sets donation status to `COMPLETED`.
  - Sets donor's `isAvailable` to `false`.
  - Sets donor's `lastDonationDate` to current timestamp.
  - Calculates `nextEligibleDate` (+90 days).
  - Increments donor's `totalDonations` counter.

---

### 💳 Phase 5 — Real bKash Tokenized Payments

#### 1. Initiate bKash Payment
- **Method:** `POST`
- **URL:** `{{baseUrl}}/api/v1/payments/bkash/create`
- **Access:** `Bearer Token (RECIPIENT or ADMIN)`
- **Request Body:**
```json
{
  "requestId": "{{requestId}}",
  "amount": 500,
  "purpose": "Emergency ambulance & blood transport logistics fund"
}
```
- **Success Response (`201 Created`):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "bKash payment initiated successfully",
  "data": {
    "paymentId": "7f8e9d0a-...",
    "bkashPaymentId": "TR001180123456",
    "bkashURL": "https://sandbox.payment.bkash.com/redirect/...",
    "amount": 500,
    "currency": "BDT",
    "status": "PENDING"
  }
}
```

#### 2. bKash Webhook Callback
- **Method:** `POST` & `GET`
- **URL:** `{{baseUrl}}/api/v1/payments/bkash/callback`
- **Access:** Public (bKash gateway callback redirect)
- **Request Body:**
```json
{
  "paymentID": "{{bkashPaymentId}}",
  "status": "success"
}
```
- **Behavior:** Calls bKash `/tokenized/checkout/execute`, validates transaction status, saves `trxID`, marks payment `COMPLETED`, and creates an immutable audit trail.

---

### 🛡️ Phase 6 — Admin Moderation & Analytics

#### 1. List All Users Directory
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/admin/users?page=1&limit=10&role=DONOR&status=ACTIVE`
- **Access:** `Bearer Token (ADMIN strictly required)`

#### 2. Suspend / Restore User Account
- **Method:** `PATCH`
- **URL:** `{{baseUrl}}/api/v1/admin/users/:id/status`
- **Access:** `Bearer Token (ADMIN strictly required)`
- **Request Body:**
```json
{
  "status": "BLOCKED",
  "reason": "Violating platform safety policies and generating false emergency alerts"
}
```
- **Behavior:** Updates user status to `BLOCKED`. User is instantly blocked from logging in or accepting requests. Records action in `AuditLog`.

#### 3. Real-Time Platform Analytics Dashboard
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/admin/dashboard-stats`
- **Access:** `Bearer Token (ADMIN strictly required)`
- **Metrics Included:**
  - User metrics: Total users, donors count, recipients count, admins count
  - Donor health: Available donors vs donors currently in 90-day cooldown
  - Blood Request metrics: Total requests, pending, fulfilled, canceled, count by urgency (`CRITICAL`, `URGENT`, `REGULAR`)
  - Financial metrics: Total logistics funds collected (BDT), completed bKash transactions count

#### 4. System Audit Logs
- **Method:** `GET`
- **URL:** `{{baseUrl}}/api/v1/admin/audit-logs?page=1&limit=20`
- **Access:** `Bearer Token (ADMIN strictly required)`
- **Description:** Complete immutable audit trail capturing administrative moderation, status changes, and financial completions.

---

## 🔒 Security & Performance Features (Phase 7)
- **Helmet Security Headers:** Protects against XSS, clickjacking, and MIME-sniffing.
- **Express Rate Limiting:**
  - Global Rate Limiter: 100 requests / 15 minutes.
  - Auth Rate Limiter: 10 requests / 15 minutes for `/login` and `/register` (brute-force defense).
- **Zod Schema Validation:** Strict input validation and sanitization on all incoming request bodies and query parameters.
- **Redis Cache with In-Memory Fallback:** Caches heavy dashboard analytics and lookups. Operates gracefully with an in-memory cache if Redis is unavailable.
- **Serverless-Safe Prisma Singleton:** Uses `globalThis.__prisma` to prevent connection pool exhaustion across short-lived serverless invocations on Vercel.
