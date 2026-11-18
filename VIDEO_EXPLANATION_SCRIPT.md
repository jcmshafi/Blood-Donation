# 🎥 Video Explanation Script — Blood Donation & Emergency Assistance Platform
> **Target Video Duration:** 5–10 Minutes  
> **Target Audience:** Technical Assessors, Project Evaluators, Hiring Managers  
> **Tool Setup:** Postman (Collection: `postman/blood-donation-platform.postman_collection.json`) + Code Editor (VS Code / Antigravity IDE) + Browser (Vercel Live URL)

---

## 🎬 Video Recording Checklist Before Pressing "Record"

1. **Terminal:** Dev server running (`bun run dev` or `npm run dev`) or test directly against your deployed Vercel live URL (`https://blood-donation-one-ecru.vercel.app`).
2. **Postman:** Import `postman/blood-donation-platform.postman_collection.json`. Ensure `{{baseUrl}}` is set to `http://localhost:5000` or your Vercel URL.
3. **VS Code:** Have the following files open in tabs for quick visual reference:
   - `src/app/module/bloodRequest/bloodRequest.route.ts` $\rightarrow$ `bloodRequest.controller.ts` $\rightarrow$ `bloodRequest.service.ts`
   - `src/app/middleware/checkAuth.ts` (RBAC)
   - `src/app/module/donation/donation.service.ts` (Concurrency lock & 90-day cooldown)
   - `src/app/module/payment/bkash.client.ts` & `payment.service.ts` (bKash integration)

---

## ⏱️ Video Timeline Overview

| Timecode | Segment | Screen Focus | Key Talking Points |
|---|---|---|---|
| **0:00 – 1:15** | **1. Project Overview & Architecture** | VS Code / Architecture Diagram | Problem solved, tech stack, modular 4-tier layer pattern |
| **1:15 – 3:00** | **2. Demonstrate All 3 Roles (RBAC)** | Postman Phase 1 & Phase 2 | DONOR, RECIPIENT, ADMIN tokens & 403 Forbidden verification |
| **3:00 – 4:45** | **3. Meaningful CRUD Operations** | Postman Phase 3 | Create, Read (filter/search/sort), Update, and Soft Delete |
| **4:45 – 6:00** | **4. Validation & Error Handling** | Postman Phase 1 & 3 | Zod validation error (400), Auth check (401), Soft-delete (404) |
| **6:00 – 7:30** | **5. bKash Payment Gateway Flow** | Postman Phase 5 | Create session $\to$ redirect URL $\to$ execute callback $\to$ DB status |
| **7:30 – 9:00** | **6. Technical Challenge Deep Dive** | VS Code (`donation.service.ts`) | Concurrency race condition locking & 90-day cooldown engine |
| **9:00 – 9:30** | **7. Summary & Conclusion** | Browser (Vercel Live URL) | Production readiness, security, wrap-up |

---

# 📜 Complete Word-for-Word Script (English Version)

---

### [0:00 – 1:15] Part 1: Project Overview & Architecture

> **🎥 Screen Action:** Start on your `README.md` or web browser showing the live deployed API, then switch to VS Code directory structure (`src/app/`).

**🎙️ What to Say:**

> *"Hello everyone! Welcome to the technical demonstration of the **Blood Donation & Emergency Assistance Platform Backend**.*
>
> *During critical medical emergencies, patients and hospitals often struggle to locate compatible, eligible blood donors in nearby hospitals in real-time. This project solves that problem with a high-performance RESTful API that handles real-time donor discovery, emergency blood requests, distance calculation, concurrent request acceptance, and ambulance transport logistics funding.*
>
> *Let's quickly look at our architecture. The codebase is organized following a strict **Modular Layered Architecture (Routes → Controllers → Services → Prisma/Database)**.*
>
> *To make this concrete, let's trace what happens when a user creates an emergency blood request (`POST /api/v1/blood-requests`):*
> 1. **Routes Layer (`bloodRequest.route.ts`):**
>    - *Acts as the front gatekeeper of incoming traffic.*
>    - *Attaches `auth(Role.RECIPIENT, Role.ADMIN)` to verify the JWT token and enforce RBAC. If a user with the `DONOR` role attempts to post a request, the route layer blocks them immediately with **403 Forbidden**.*
>    - *Attaches `validateRequest(createBloodRequestSchema)` using **Zod** to validate that `patientName`, `bloodGroup`, hospital GPS coordinates (`latitude`, `longitude`), and urgency levels match our schema. If invalid, it immediately responds with **400 Bad Request** before reaching the controller.*
> 2. **Controllers Layer (`bloodRequest.controller.ts`):**
>    - *Once validation passes, the controller extracts the HTTP request payload (`req.body`) and the authenticated user identity (`req.user.userId`).*
>    - *Controllers contain zero database queries or heavy domain logic.*
>    - *Every handler is wrapped in a `catchAsync` utility, ensuring any asynchronous errors automatically forward to our centralized `globalErrorHandler` without messy try/catch blocks.*
>    - *It invokes the service layer and uses `sendResponse()` to return a uniform JSON format (`statusCode: 201, success: true, message, data`).*
> 3. **Services Layer (`bloodRequest.service.ts`):**
>    - *The computational brain containing all core business logic.*
>    - *Enforces domain rules: checks requester status, sets default urgency and fulfilled units counter, and triggers activity audit logging.*
>    - *For matching and acceptance workflows, this layer computes complex logic like the Haversine distance formula and checks ABO blood compatibility rules.*
> 4. **Prisma & Database Layer (`prisma.ts` / PostgreSQL):**
>    - *The service calls Prisma ORM (`prisma.bloodRequest.create({ data: ... })`).*
>    - *Prisma generates parameterized, type-safe SQL queries against our PostgreSQL database.*
>    - *For sensitive workflows like donor request acceptance, it runs inside `prisma.$transaction`, applying PostgreSQL row-level pessimistic locking (`FOR UPDATE`) to prevent concurrent double-booking.*
>
> *This decoupled structure ensures maintainability, clean testability, and industry-standard separation of concerns. Now, let's jump into Postman to demonstrate how the system works in practice."*

---

### [1:15 – 3:00] Part 2: Demonstrate All 3 Roles (RBAC) & 403 Forbidden Security

> **🎥 Screen Action:** Open Postman $\rightarrow$ Open `Folder 1 (Phase 1)` and `Folder 2 (Phase 2)`.

**🎙️ What to Say:**

> *"Our platform strictly enforces **Role-Based Access Control (RBAC)** across three primary user roles: **DONOR**, **RECIPIENT**, and **ADMIN**.*
>
> *Let's authenticate each role to show how access is scoped:*
>
> 1. **[Click Send on Request 1: 'Register as DONOR']**
>    *"Here, we register a Donor user named Tanvir Hasan with blood group O-Positive and Mirpur coordinates. Notice that our test script immediately captures the JWT `accessToken` and assigns the `DONOR` role."*
>
> 2. **[Click Send on Request 2: 'Register as RECIPIENT']**
>    *"Next, we register a Recipient user. Recipients can post emergency requests and sponsor transport funds, but they do not have a donor medical profile."*
>
> 3. **[Click Send on Request 3: 'Login as Admin']**
>    *"Third, we log in as the pre-seeded Administrator. This gives us an `adminAccessToken` with full moderation privileges."*
>
> 4. **[Demonstrate 403 Forbidden - Role Safeguard]**
>    *(Open Folder 2, Request 5: `PATCH /api/v1/users/donor-profile` using Recipient token)*  
>    **[Click Send]**
>    *"Now, let's test our security boundary. Here, a user with the **RECIPIENT** role tries to update the donor medical profile at `/api/v1/users/donor-profile`. Notice the response: **403 Forbidden** with `message: 'You are not authorized! Role DONOR is required'`. The system cleanly blocks unauthorized cross-role tampering."*
>
> 5. *(Optional Quick Admin Check: Open Folder 6, Request 24b)*  
>    **[Click Send]**
>    *"Similarly, if a regular Donor attempts to inspect administrative dashboard analytics, the server instantly returns **403 Forbidden**."*

---

### [3:00 – 4:45] Part 3: Meaningful CRUD Operations (Blood Request Lifecycle)

> **🎥 Screen Action:** Open Postman $\rightarrow$ Open `Folder 3: Phase 3 - Emergency Blood Request Lifecycle`.

**🎙️ What to Say:**

> *"Now let's demonstrate full **CRUD operations** on our core domain entity: the **Emergency Blood Request**.*
>
> 1. **CREATE (POST):**  
>    *(Open Request 1: `Create Emergency Blood Request`)*  
>    **[Click Send]**  
>    *"We send a `POST` request to `/api/v1/blood-requests` as a Recipient. In the JSON body, we supply the patient name, hospital name ('Dhaka Medical College'), hospital GPS coordinates, blood group 'B_POSITIVE', required units, and urgency level 'CRITICAL'.*  
>    *The server creates the record with an initial status of `PENDING` and returns **201 Created**. Our test script stores this `requestId` automatically."*
>
> 2. **READ (GET with Filters, Search & Pagination):**  
>    *(Open Request 2: `Get All Blood Requests`)*  
>    **[Click Send]**  
>    *"Next is our `GET` endpoint. Notice how flexible our query parameters are: we can filter by `bloodGroup=B_POSITIVE`, `urgency=CRITICAL`, and `status=PENDING` with pagination metadata (`page`, `limit`, `total`, `totalPages`).*  
>    *(Open Request 3: `Search Blood Requests` and Click Send)*  
>    *We also support full-text keyword search. Searching for 'Dhaka Medical' queries across patient name, hospital name, and hospital address."*
>
> 3. **UPDATE (PATCH):**  
>    *(Open Request 5: `Update Blood Request Details`)*  
>    **[Click Send]**  
>    *"For updating, the owner recipient sends a `PATCH` request to `/api/v1/blood-requests/:id`. We can modify the requested units from 2 to 3, or update clinical notes. The server updates the database and returns the modified object with **200 OK**."*
>
> 4. **DELETE (Soft Delete):**  
>    *(Open Request 6: `Soft Delete Blood Request`)*  
>    **[Click Send]**  
>    *"Finally, when a request is canceled, we execute a `DELETE` request. Rather than destroying relational history, we implement a **Soft Delete**: `isDeleted` is set to `true`, and status transitions to `CANCELED`."*
>
> 5. *(Open Request 7: `Verify Soft Deleted Request is Excluded (404 Check)`)*  
>    **[Click Send]**  
>    *"To prove that soft-deleted requests are excluded, when we query this request by ID, the system returns **404 Not Found**."*

---

### [4:45 – 6:00] Part 4: Validation & Error Handling Demonstration

> **🎥 Screen Action:** Open Postman $\rightarrow$ Open Phase 1 Request 1 (`Register`) or Phase 3 Request 1.

**🎙️ What to Say:**

> *"Next, let's explore our **Input Validation and Centralized Error Handling** built with **Zod** and custom error middlewares.*
>
> 1. **Triggering 400 Bad Request (Validation Error):**  
>    *(Edit the registration body: change `"email": "tanvir.donor@example.com"` to `"email": "invalid-email-address"` or leave `"password": "123"` with less than 6 chars)*  
>    **[Click Send]**  
>    *"Look at the response format. Instead of crashing or returning raw stack traces, the server responds with **400 Bad Request** in a standardized format:*
>    ```json
>    {
>      "success": false,
>      "message": "Validation Error",
>      "errorSources": [
>        { "path": "email", "message": "Invalid email address" }
>      ]
>    }
>    ```
>    *This gives frontend developers exact field-level error messages to render on UI inputs.*
>
> 2. **Triggering 401 Unauthorized:**  
>    *(Select any protected route like `GET /api/v1/users/me`, go to Headers, uncheck the Authorization header)*  
>    **[Click Send]**  
>    *"If a request lacks a valid token or uses an expired token, the server returns a clean **401 Unauthorized** with `message: 'You are not authorized!'`.*
>
> 3. **Triggering 404 Not Found:**  
>    *(Send a request to a random UUID `/api/v1/blood-requests/00000000-0000-0000-0000-000000000000`)*  
>    **[Click Send]**  
>    *"When querying non-existent or deleted entities, our custom `AppError` class returns a clean **404 Not Found**."*

---

### [6:00 – 7:30] Part 5: bKash Payment Gateway Flow

> **🎥 Screen Action:** Open Postman $\rightarrow$ Open `Folder 5: Phase 5 - Real bKash Payments`.

**🎙️ What to Say:**

> *"In medical emergencies, arranging transport logistics or ambulance support is critical. We built a full **bKash Tokenized Checkout** payment workflow:*
>
> 1. **Create Payment Session:**  
>    *(Open Request 18: `Initiate bKash Payment`)*  
>    **[Click Send]**  
>    *"The recipient initiates a payment of 500 BDT linked to the active blood request. Our backend talks to bKash's `/tokenized/checkout/create` API, creates a pending local `Payment` transaction record, and returns a live `bkashURL` gateway redirect link along with the bKash `paymentID`. In a real frontend, the user is redirected to this URL to enter their bKash PIN."*
>
> 2. **Callback Handling & Backend Execution:**  
>    *(Open Request 19: `Execute bKash Payment on Callback`)*  
>    **[Click Send]**  
>    *"When the user completes payment on bKash, bKash redirects back to our callback endpoint `/api/v1/payments/bkash/callback`.  
>    Our backend intercepts the callback, calls bKash's `/tokenized/checkout/execute` endpoint for server-to-server verification, captures the irreversible `trxID`, marks the transaction `COMPLETED`, and writes an immutable audit log entry."*
>
> 3. **Verify Database Update:**  
>    *(Open Request 20: `Get Payment Details & Status`)*  
>    **[Click Send]**  
>    *"Querying the payment record confirms that the payment status is now `COMPLETED` with transaction ID, merchant invoice, and linked request details fully persisted in PostgreSQL."*

---

### [7:30 – 9:00] Part 6: Technical Challenge Deep Dive

> **🎥 Screen Action:** Switch to VS Code and show `src/app/module/donation/donation.service.ts` around `acceptBloodRequest` and `updateDonationStatus`.

**🎙️ What to Say:**

> *"Now, I'd like to highlight one major **Technical Challenge** we tackled in this system: **Pessimistic Concurrency Locking & Race Condition Prevention** during donor request acceptance.*
>
> *Imagine a scenario where an emergency blood request requires only 1 unit of blood. Two compatible donors, Donor A and Donor B, open their app at the same instant and both hit 'Accept'. In a naive database setup, both requests would read the status as 'PENDING', both would create donation records, and the hospital would erroneously have two donors allocated for one unit.*
>
> *Here is how we solved it in `donation.service.ts`:*
> 1. *We wrap the acceptance logic inside a **Prisma Interactive Transaction** (`prisma.$transaction`).*
> 2. *Within the transaction, we acquire a row lock and verify that the request is currently `PENDING` and unfulfilled.*
> 3. *The first donor's transaction decrements the remaining units and transitions the status to `ACCEPTED`.*
> 4. *When the second donor's transaction executes a millisecond later, the lock releases, it reads the updated state, detects that the request has already been claimed, and throws an HTTP **409 Conflict** error with the message: `'This blood request has already been accepted or fulfilled'`.*
>
> *(Show lines in Postman Folder 4, Request 15 and 15b)*  
> *In Postman, Request 15 accepts the request successfully, and Request 15b immediately simulates the race condition, returning the expected **409 Conflict**.*
>
> *Additionally, when the donation is completed, our **90-Day Cooldown Engine** automatically sets the donor's `isAvailable` to false and calculates their exact next eligible donation date, protecting donor health according to international medical standards."*

---

### [9:00 – 9:30] Part 7: Summary & Conclusion

> **🎥 Screen Action:** Switch back to browser showing the live Vercel deployment URL and Swagger/Postman docs.

**🎙️ What to Say:**

> *"To summarize:*
> - *We built a production-ready, fully hardened backend powered by Express 5, TypeScript, Prisma, and PostgreSQL.*
> - *We demonstrated all 3 roles with strict RBAC and 403 Forbidden enforcement.*
> - *We showcased comprehensive CRUD with soft-deletes, Zod error validation, and a live bKash tokenized payment integration.*
> - *And we solved high-concurrency race conditions using database transactions and automated donor cooldowns.*
>
> *The project is live on **Vercel** with full documentation in our repository's `README.md` and `POSTMAN_DOCUMENTATION.md`.*
>
> *Thank you very much for watching!"*

---

<br/>

---

# 🇧🇩 Complete Bengali Script (বাংলা স্ক্রিপ্ট)
*(যাঁরা বাংলায় ভিডিও রেকর্ড করতে চান, তাঁদের জন্য নিচে পূর্ণাঙ্গ স্ক্রিপ্ট দেওয়া হলো)*

---

### [০:০০ – ১:১৫] পর্ব ১: প্রজেক্ট ওভারভিউ এবং আর্কিটেকচার
> **🎥 স্ক্রিন:** `README.md` অথবা ব্রাউজারে Vercel লাইভ API ওপেন রাখুন, এরপর VS Code-এর ফাইল স্ট্রাকচার দেখান।

**🎙️ যা বলবেন:**
> *"আসসালামু আলাইকুম সবাইকে। আজকের ভিডিওতে আমি আমাদের **Blood Donation & Emergency Assistance Platform**-এর ব্যাকএন্ড আর্কিটেকচার এবং লাইভ API ডেমো উপস্থাপন করব।*
>
> *মেডিকেল ইমার্জেন্সির সময় রোগীর জন্য দ্রুত রক্তের ডোনার খুঁজে পাওয়া একটি বড় চ্যালেঞ্জ। আমাদের এই ব্যাকএন্ড প্ল্যাটফর্মটি রিয়েল-টাইম ডোনার ডিসকভারি, জিওস্পেশিয়াল ডিসট্যান্স ম্যাচিং, কনকারেন্ট রিকোয়েস্ট একসেপ্টেন্স এবং অ্যাম্বুলেন্স ট্র্যান্সপোর্ট ফান্ডের জন্য বিকাশ পেমেন্ট সুবিধা নিশ্চিত করে।*
>
> *আমাদের সিস্টেমটি একটি ক্লিন **Modular Layered Architecture (Routes → Controllers → Services → Prisma/Database)** মেনে তৈরি করা হয়েছে।*
>
> *বিষয়টি পরিষ্কারভাবে বোঝার জন্য একটি বাস্তব উদাহরণ দিই—যেমন একজন রিসিপিয়েন্ট যখন একটি ইমার্জেন্সি ব্লাড রিকোয়েস্ট তৈরি করেন (`POST /api/v1/blood-requests`):*
>
> ১. **Routes Layer (`bloodRequest.route.ts`):**  
>    - *রিকোয়েস্টটি সার্ভারে পৌঁছালে রাউট লেয়ার প্রথমে ট্রাফিকের গেটকিপার হিসেবে কাজ করে।*  
>    - *এখানে `auth(Role.RECIPIENT, Role.ADMIN)` মিডলওয়্যার যুক্ত থাকে, যা JWT টোকেন ভেরিফাই করে এবং রোল চেক করে। যদি কোনো `DONOR` ভুল করে এখানে হিট করে, তবে রাউট লেয়ারই তাকে আটকে দিয়ে **403 Forbidden** রিটার্ন করে।*  
>    - *একই সাথে `validateRequest(createBloodRequestSchema)` মিডলওয়্যার **Zod** স্কিমা ব্যবহার করে যাচাই করে যে রোগীর নাম, রক্তের গ্রুপ, হাসপাতালের অক্ষাংশ ও দ্রাঘিমাংশ (GPS Coordinates) এবং আরজেন্সি লেভেল সঠিক নিয়মে পাঠানো হয়েছে কি না। ডাটা ভুল থাকলে তা কন্ট্রোলারে না গিয়ে সাথে সাথে **400 Bad Request** হিসেবে ফেরত যায়।*  
>
> ২. **Controllers Layer (`bloodRequest.controller.ts`):**  
>    - *ভ্যালিডেশন সফল হলে কন্ট্রোলার কল হয়। কন্ট্রোলারের মূল দায়িত্ব হলো শুধু HTTP রিকোয়েস্ট থেকে প্রয়োজনীয় ইনপুটগুলো (যেমন `req.body` এবং টোকেন থেকে প্রাপ্ত `req.user.userId`) সংগ্রহ করা।*  
>    - *কন্ট্রোলারে কোনো ডেটাবেস কোয়েরি বা জটিল বিজনেস লজিক থাকে না।*  
>    - *প্রতিটি হ্যান্ডলার `catchAsync` র‍্যাপার দিয়ে মোড়ানো, যার ফলে কোনো রানটাইম এরর বা এক্সেপশন তৈরি হলে সার্ভার ক্র্যাশ না করে স্বয়ংক্রিয়ভাবে সেন্ট্রাল `globalErrorHandler`-এ চলে যায়।*  
>    - *কন্ট্রোলার ডাটা নিয়ে সার্ভিস লেয়ারকে কল করে এবং সার্ভিস থেকে রেজাল্ট আসার পর `sendResponse()` ইউটিলিটি দিয়ে একটি স্ট্যান্ডার্ড ফরম্যাটে (`statusCode: 201, success: true, message, data`) ক্লায়েন্টকে রেসপন্স ফেরত পাঠায়।*  
>
> ৩. **Services Layer (`bloodRequest.service.ts`):**  
>    - *সার্ভিস লেয়ার হলো আমাদের অ্যাপ্লিকেশনের "মস্তিষ্ক" বা কোর বিজনেস লজিক হাব।*  
>    - *এখানে সমস্ত ডোমেন রুলস যাচাই করা হয়—যেমন আবেদনকারীর অ্যাকাউন্ট অ্যাক্টিভ আছে কি না, ডিফল্ট আরজেন্সি ও ইউনিট কাউন্ট নির্ধারণ এবং অ্যাক্টিভিটি অডিট ট্রেইলে লগ সংরক্ষণ করা।*  
>    - *অন্যান্য জটিল লজিকগুলোও (যেমন ডোনার খোঁজার ক্ষেত্রে Haversine ফর্মুলা দিয়ে কিমি দূরত্ব হিসাব করা বা আন্তর্জাতিক নিয়ম অনুযায়ী ৯০ দিনের কুলডাউন চেক করা) এই সার্ভিস লেয়ারেই সম্পন্ন হয়।*  
>
> ৪. **Prisma & Database Layer (`prisma.ts` / PostgreSQL):**  
>    - *সার্ভিস লেয়ার প্রিজমা ক্লায়েন্টকে কল করে (`prisma.bloodRequest.create({ data: ... })`)।*  
>    - *প্রিজমা সম্পূর্ণ টাইপ-সেফ কোয়েরি তৈরি করে সরাসরি আমাদের PostgreSQL ডেটাবেসে ডাটা স্থায়ীভাবে সংরক্ষণ করে।*  
>    - *এছাড়া কনকারেন্ট অপারেশনের সময় (যেমন ডোনার কর্তৃক রিকোয়েস্ট একসেপ্টেন্স) প্রিজমা ট্রানজ্যাকশন (`prisma.$transaction`) ডেটাবেসে রো-লেভেল pessimistic lock (`FOR UPDATE`) নিশ্চিত করে race condition বা ডাবল বুকিং পুরোপুরি প্রতিরোধ করে।*  
>
> *এই ডিকাপল্ড আর্কিটেকচারের কারণে আমাদের কোড অত্যন্ত ক্লিন, টেস্টেবল এবং প্রোডাকশন-রেডি। চলুন এখন সরাসরি পোস্টম্যানে গিয়ে API-গুলো টেস্ট করে দেখি।"*

---

### [১:১৫ – ৩:০০] পর্ব ২: ৩টি রোল (RBAC) এবং ৪০৩ Forbidden সিকিউরিটি ডেমো
> **🎥 স্ক্রিন:** Postman $\rightarrow$ Folder 1 (Phase 1) & Folder 2 (Phase 2)

**🎙️ যা বলবেন:**
> *"আমাদের সিস্টেমে **Role-Based Access Control (RBAC)**-এর আওতায় প্রধান ৩টি রোল রয়েছে: **DONOR**, **RECIPIENT**, এবং **ADMIN**।*
>
> ১. *(পোস্টম্যানে Request 1 'Register as DONOR' সেন্ড করুন)*  
> *"প্রথমে আমরা একজন ডোনারকে রেজিস্টার করছি। সাথে সাথে তার জন্য একটি ডোনার প্রোফাইল তৈরি হচ্ছে এবং রেসপন্সে JWT অ্যাকসেস টোকেন পাওয়া যাচ্ছে। আমাদের টেস্ট স্ক্রিপ্ট স্বয়ংক্রিয়ভাবে এই টোকেনটি পোস্টম্যান ভেরিয়েবলে সেভ করে নেয়।"*
>
> ২. *(Request 2 'Register as RECIPIENT' সেন্ড করুন)*  
> *"এরপর একজন রিসিপিয়েন্ট রেজিস্টার করছি, যিনি ইমার্জেন্সি রক্তের আবেদন করতে পারবেন।"*
>
> ৩. *(Request 3 'Login as Admin' সেন্ড করুন)*  
> *"এবং তিন নম্বরে অ্যাডমিন হিসেবে লগইন করে অ্যাডমিন অ্যাকসেস টোকেন নিশ্চিত করছি।"*
>
> ৪. **[৪০৩ Forbidden ডেমো]:**  
> *(Folder 2-এর Request 5: `PATCH /api/v1/users/donor-profile` রিসিপিয়েন্ট টোকেন দিয়ে সেন্ড করুন)*  
> *"এখন সিকিউরিটি টেস্ট দেখুন: একজন **RECIPIENT** যদি ডোনারের প্রোফাইল আপডেট এন্ডপয়েন্টে হিট করে, সার্ভার সাথে সাথে **403 Forbidden** রিটার্ন করে এবং মেসেজ দেয়: `'You are not authorized! Role DONOR is required'`। এর মাধ্যমে প্রমাণ হয় যে কোনো অননুমোদিত ইউজার অন্য রোলের ডাটা পরিবর্তন করতে পারবে না।"*

---

### [৩:০০ – ৪:৪৫] পর্ব ৩: CRUD অপারেশনস (ব্লাড রিকোয়েস্ট লাইফসাইকেল)
> **🎥 স্ক্রিন:** Postman $\rightarrow$ Folder 3 (Phase 3)

**🎙️ যা বলবেন:**
> *"এখন আমরা ব্লাড রিকোয়েস্টের পূর্ণাঙ্গ **CRUD** অপারেশনস দেখব:*
>
> ১. **CREATE (POST):** *(Request 1 সেন্ড করুন)*  
> *"রিসিপিয়েন্ট হিসেবে আমরা `/api/v1/blood-requests`-এ POST রিকোয়েস্ট পাঠাচ্ছি। রোগীর নাম, ঢাকা মেডিকেল কলেজ হসপিটালের জিপিএস লোকেশন, রক্তের গ্রুপ B_POSITIVE, প্রয়োজনীয় ইউনিট এবং urgency হিসেবে 'CRITICAL' দেওয়া হয়েছে। সার্ভার এটি তৈরি করে **201 Created** রেসপন্স দিচ্ছে এবং স্ট্যাটাস এখন `PENDING`।"*
>
> ২. **READ (GET with Filters & Search):** *(Request 2 এবং Request 3 সেন্ড করুন)*  
> *"আমাদের GET এন্ডপয়েন্টে রক্তের গ্রুপ, আরজেন্সি এবং পেজিনেশন দিয়ে ফিল্টার করা যায়। এছাড়াও কি-ওয়ার্ড সার্চ দিয়ে হসপিটালের নাম বা ঠিকানা দিয়ে রিকোয়েস্ট খোঁজা সম্ভব।"*
>
> ৩. **UPDATE (PATCH):** *(Request 5 সেন্ড করুন)*  
> *"PATCH রিকোয়েস্টের মাধ্যমে রিকোয়েস্টের প্রয়োজনীয় ইউনিট সংখ্যা বা নোট আপডেট করা যাচ্ছে।"*
>
> ৪. **DELETE (Soft Delete):** *(Request 6 এবং Request 7 সেন্ড করুন)*  
> *"আমরা ডাটা স্থায়ীভাবে মুছে না ফেলে **Soft Delete** ব্যবহার করেছি—অর্থাৎ `isDeleted: true` করা হয়। পরবর্তীতে এই আইডি দিয়ে সার্চ করলে এটি আর পাবলিকলি পাওয়া যায় না এবং ক্লিন **404 Not Found** রিটার্ন করে।"*

---

### [৪:৪৫ – ৬:০০] পর্ব ৪: ভ্যালিডেশন এবং এরর হ্যান্ডলিং (Zod & Global Error)
> **🎥 স্ক্রিন:** Postman $\rightarrow$ Phase 1 Registration Body

**🎙️ যা বলবেন:**
> *"আমাদের প্ল্যাটফর্মে **Zod** দিয়ে প্রতিটি রিকোয়েস্ট বডি ভ্যালিডেট করা হয়।*
>
> ১. **400 Bad Request (Validation):**  
> *(ইমেইলের জায়গায় ভুল টেক্সট যেমন `"not-an-email"` দিয়ে সেন্ড করুন)*  
> *"দেখুন, ভুল ইমেইল ফরম্যাট দেওয়ার সাথে সাথে সার্ভার ক্র্যাশ না করে একটি সুন্দর স্ট্রাকচার্ড **400 Bad Request** রেসপন্স দিয়েছে, যেখানে `errorSources`-এ নির্দিষ্টভাবে বলা আছে কোন ফিল্ডে কী ভুল হয়েছে।*
>
> ২. **401 Unauthorized:**  
> *(যেকোনো প্রোটেক্টেড রুটের Authorization হেডার আনচেক করে সেন্ড করুন)*  
> *"টোকেন ছাড়া রিকোয়েস্ট পাঠালে সার্ভার সাথে সাথে **401 Unauthorized** দেয়।*
>
> ৩. **404 Not Found:**  
> *"এবং কোনো অস্তিত্বহীন রুটে বা মুছে ফেলা ডাটাতে হিট করলে সেন্ট্রালাইজড এরর হ্যান্ডলার ক্লিন **404 Not Found** মেসেজ হ্যান্ডেল করে।"*

---

### [৬:০০ – ৭:৩০] পর্ব ৫: বিকাশ পেমেন্ট গেটওয়ে ফ্লো (Tokenized bKash)
> **🎥 স্ক্রিন:** Postman $\rightarrow$ Folder 5 (Phase 5)

**🎙️ যা বলবেন:**
> *"ইমার্জেন্সি অ্যাম্বুলেন্স বা রক্তের ট্রান্সপোর্ট খরচের জন্য আমরা রিয়েল **bKash Tokenized Checkout** ইন্টিগ্রেট করেছি:*
>
> ১. **Create Payment Session:** *(Request 18 সেন্ড করুন)*  
> *"রিসিপিয়েন্ট ৫০০ টাকার একটি পেমেন্ট ইনিশিয়েট করার পর আমাদের ব্যাকএন্ড বিকাশের ক্রিয়েট API কল করে এবং একটি `bkashURL` ও `paymentID` রিটার্ন করে। ব্যবহারকারী এই লিংকে গিয়ে বিকাশ পিন দিয়ে পেমেন্ট সম্পন্ন করেন।*
>
> ২. **Callback & Backend Verification:** *(Request 19 সেন্ড করুন)*  
> *"পেমেন্ট শেষে বিকাশ থেকে আমাদের কলব্যাক রুটে রিডাইরেক্ট হয়। ব্যাকএন্ড স্বয়ংক্রিয়ভাবে বিকাশের Execute API কল করে ট্রানজ্যাকশন ভেরিফাই করে, বিকাশের `trxID` ডাটাবেসে সেভ করে এবং পেমেন্ট স্ট্যাটাস `COMPLETED` করে একটি অডিট লগ এন্ট্রি তৈরি করে।*
>
> ৩. **Database Verification:** *(Request 20 সেন্ড করুন)*  
> *"পেমেন্ট ডিটেইলস চেক করলে আমরা দেখতে পাই ডাটাবেসে ট্রানজ্যাকশন আইডি ও কমপ্লিট স্ট্যাটাস নির্ভুলভাবে সংরক্ষিত হয়েছে।"*

---

### [৭:৩০ – ৯:০০] পর্ব ৬: টেকনিক্যাল চ্যালেঞ্জ (Concurrency Lock & Cooldown)
> **🎥 স্ক্রিন:** VS Code $\rightarrow$ `src/app/module/donation/donation.service.ts`

**🎙️ যা বলবেন:**
> *"এই প্রজেক্টের সবচেয়ে বড় **টেকনিক্যাল চ্যালেঞ্জ** ছিল: **Pessimistic Concurrency Locking & Race Condition Prevention**।*
>
> *মনে করুন, একটি ইমার্জেন্সি রিকোয়েস্টে মাত্র ১ ইউনিট রক্ত প্রয়োজন। একই মুহূর্তে দুজন ডোনার 'Accept' বাটনে চাপ দিলেন। সাধারণ ডাটাবেস হলে দুজনই ডাটা রিড করে একসেপ্ট করে ফেলত, যার ফলে ডাটাবেসে ডাবল বুকিংয়ের অসঙ্গতি দেখা দিত।*
>
> *আমরা এটি সমাধান করেছি **Prisma Interactive Transaction** (`prisma.$transaction`) এবং PostgreSQL রো-লেভেল লকিংয়ের মাধ্যমে। প্রথম ডোনারের রিকোয়েস্ট আসার সাথে সাথে রো-টি লক হয়ে যায় এবং স্ট্যাটাস `ACCEPTED` হয়ে যায়। ঠিক ১ মিলি-সেকেন্ড পর দ্বিতীয় ডোনারের ট্রানজ্যাকশন যখন চেক করে, তখন সে দেখতে পায় রিকোয়েস্টটি আর `PENDING` নেই, এবং সাথে সাথে ক্লিন **409 Conflict** এরর রিটার্ন করে: `'Blood request has already been accepted or fulfilled'`।*
>
> *(পোস্টম্যানে Request 15 এবং 15b দেখিয়ে প্রমাণ করুন)*  
> *একই সাথে, রক্তদান সম্পন্ন হওয়ার সাথে সাথে আমাদের **90-Day Cooldown Engine** সক্রিয় হয়ে ডোনারের অ্যাভেইলেবিলিটি বন্ধ করে দেয় এবং আন্তর্জাতিক মেডিকেল নিয়ম অনুযায়ী পরবর্তী ৯০ দিনের জন্য নতুন রক্তদান ব্লক রাখে।"*

---

### [৯:০০ – ৯:৩০] পর্ব ৭: কনক্লুশন এবং লাইভ ডিপ্লয়মেন্ট
> **🎥 স্ক্রিন:** ব্রাউজারে Vercel লাইভ সাইট এবং GitHub রিপোজিটরি

**🎙️ যা বলবেন:**
> *"পরিশেষে, আমাদের পুরো ব্যাকএন্ড সফলভাবে **Vercel**-এ সার্ভারলেস হিসেবে ডিপ্লয় করা হয়েছে। আমাদের গিটহাব রিপোজিটরির `README.md` এবং `POSTMAN_DOCUMENTATION.md`-তে প্রতিটি এন্ডপয়েন্টের পুঙ্খানুপুঙ্খ বিবরণ রয়েছে।*
>
> *ধৈর্য ধরে ভিডিওটি দেখার জন্য সবাইকে আন্তরিক ধন্যবাদ!"*

---

## 💡 Quick Tips for High Marks / Best Recording
1. **Speak clearly and at a steady pace.**
2. **Keep Postman on dark mode** (Settings $\rightarrow$ General $\rightarrow$ Dark Theme) for great video contrast.
3. **Use Zoom or OBS Studio:** Share your entire screen so the transition between Postman, VS Code, and Browser is seamless.
4. **Pre-run the requests once** before starting the recording so Postman collection variables are already populated and cached.
