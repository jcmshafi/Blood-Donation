
      import { createRequire } from 'module';
      const require = createRequire(import.meta.url);
    
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/app.ts
import cookieParser from "cookie-parser";
import cors from "cors";
import express2 from "express";
import helmet from "helmet";
import httpStatus18 from "http-status";

// src/app/config/index.ts
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(process.cwd(), ".env") });
var config_default = {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  bak_url: process.env.APP_URL,
  frontend_url: process.env.FRONTEND_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET || "default_jwt_access_secret_for_emergency_platform",
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET || "default_jwt_refresh_secret_for_emergency_platform",
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || "1d",
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  // Stripe runs in test mode only (sk_test_ keys); initiation answers 503 until a test key is set.
  stripe_secret_key: process.env.STRIPE_SECRET_KEY || "",
  stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || "",
  stripe_currency: (process.env.STRIPE_CURRENCY || "bdt").toLowerCase(),
  // Test-only override of the Stripe API origin (a local stand-in server).
  stripe_api_base_url: process.env.STRIPE_API_BASE_URL || "",
  google_client_id: process.env.GOOGLE_CLIENT_ID,
  email_user: process.env.EMAIL_USER,
  google_app_password: process.env.GOOGLE_APP_PASSWORD
};

// src/app/middleware/globalErrorHandler.ts
import httpStatus from "http-status";
import { ZodError } from "zod";

// src/generated/prisma/client.ts
import * as path2 from "path";
import { fileURLToPath } from "url";

// src/generated/prisma/internal/class.ts
import * as runtime from "@prisma/client/runtime/client";
var config = {
  "previewFeatures": [],
  "clientVersion": "7.10.0",
  "engineVersion": "0edf323efd1d98336f3f0a68684b56f689b900d3",
  "activeProvider": "postgresql",
  "inlineSchema": 'model BloodRequest {\n  id              String        @id @default(uuid())\n  requesterId     String\n  requester       User          @relation(fields: [requesterId], references: [id], onDelete: Restrict)\n  patientName     String\n  bloodGroup      BloodGroup\n  unitsNeeded     Int           @default(1)\n  unitsFulfilled  Int           @default(0)\n  hospitalName    String\n  hospitalAddress String\n  latitude        Float\n  longitude       Float\n  contactNumber   String\n  urgency         UrgencyLevel  @default(NORMAL)\n  status          RequestStatus @default(OPEN)\n  notes           String?\n  isDeleted       Boolean       @default(false)\n  deletedAt       DateTime?\n  createdAt       DateTime      @default(now())\n  updatedAt       DateTime      @updatedAt\n\n  assignments DonationAssignment[]\n  payments    Payment[]\n\n  @@index([bloodGroup, urgency, status])\n  @@index([isDeleted, deletedAt])\n  @@index([createdAt])\n  @@map("blood_requests")\n}\n\nmodel DonationAssignment {\n  id          String         @id @default(uuid())\n  requestId   String\n  request     BloodRequest   @relation(fields: [requestId], references: [id], onDelete: Restrict)\n  donorId     String\n  donor       User           @relation(fields: [donorId], references: [id], onDelete: Restrict)\n  status      DonationStatus @default(ASSIGNED)\n  notes       String?\n  completedAt DateTime?\n  createdAt   DateTime       @default(now())\n  updatedAt   DateTime       @updatedAt\n\n  @@unique([requestId, donorId])\n  @@index([status])\n  @@map("donation_assignments")\n}\n\nenum Role {\n  DONOR\n  RECIPIENT\n  ADMIN\n}\n\nenum UserStatus {\n  ACTIVE\n  BLOCKED\n}\n\nenum BloodGroup {\n  A_POSITIVE\n  A_NEGATIVE\n  B_POSITIVE\n  B_NEGATIVE\n  AB_POSITIVE\n  AB_NEGATIVE\n  O_POSITIVE\n  O_NEGATIVE\n}\n\nenum UrgencyLevel {\n  NORMAL\n  URGENT\n  CRITICAL\n}\n\nenum RequestStatus {\n  OPEN\n  MATCHED\n  FULFILLED\n  CANCELLED\n}\n\nenum DonationStatus {\n  ASSIGNED\n  COMPLETED\n  CANCELLED\n}\n\nenum PaymentStatus {\n  PENDING\n  COMPLETED\n  FAILED\n  CANCELLED\n}\n\nenum PaymentMethod {\n  BKASH\n  STRIPE\n}\n\n// Obsolete model removed.\n\nmodel Payment {\n  id                     String        @id @default(uuid())\n  requestId              String\n  request                BloodRequest  @relation(fields: [requestId], references: [id], onDelete: Restrict)\n  payerId                String\n  payer                  User          @relation(fields: [payerId], references: [id], onDelete: Restrict)\n  amount                 Float // legacy float, kept readable; amountMinor is authoritative\n  amountMinor            Int // exact amount in poisha (150.50 BDT = 15050)\n  currency               String        @default("BDT")\n  paymentMethod          PaymentMethod @default(BKASH)\n  paymentId              String        @unique // bKash paymentID\n  transactionId          String? // bKash trxID\n  status                 PaymentStatus @default(PENDING)\n  paymentExecuteResponse Json?\n  merchantInvoiceNumber  String?       @unique\n  checkoutUrl            String?\n  idempotencyKey         String?\n  initiationFingerprint  String?\n  failureReason          String?\n  createdAt              DateTime      @default(now())\n  updatedAt              DateTime      @updatedAt\n\n  @@unique([payerId, idempotencyKey])\n  @@index([requestId])\n  @@index([status, paymentId])\n  @@map("payments")\n}\n\n// Stripe webhook events already processed (event IDs are unique), so replays do nothing.\nmodel PaymentWebhookEvent {\n  id          String   @id // Stripe event ID (evt_...)\n  type        String\n  processedAt DateTime @default(now())\n\n  @@map("payment_webhook_events")\n}\n\nmodel AuditLog {\n  id         String   @id @default(uuid())\n  userId     String?\n  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)\n  action     String\n  resource   String\n  resourceId String?\n  details    Json?\n  ipAddress  String?\n  createdAt  DateTime @default(now())\n\n  @@index([action, resource])\n  @@index([createdAt])\n  @@map("audit_logs")\n}\n\n// This is your Prisma schema file,\n// learn more about it in the docs: https://pris.ly/d/prisma-schema\n\n// Looking for ways to speed up your queries, or scale easily with your serverless or edge functions?\n// Try Prisma Accelerate: https://pris.ly/cli/accelerate-init\n\ngenerator client {\n  provider = "prisma-client"\n  output   = "../../src/generated/prisma"\n}\n\ndatasource db {\n  provider = "postgresql"\n}\n\nmodel User {\n  id        String     @id @default(uuid())\n  name      String\n  email     String     @unique\n  password  String?\n  role      Role       @default(RECIPIENT)\n  status    UserStatus @default(ACTIVE)\n  googleId  String?    @unique\n  phone     String?\n  address   String?\n  isDeleted Boolean    @default(false)\n  deletedAt DateTime?\n  createdAt DateTime   @default(now())\n  updatedAt DateTime   @updatedAt\n\n  donorProfile  DonorProfile?\n  bloodRequests BloodRequest[]\n  assignments   DonationAssignment[]\n  payments      Payment[]\n  auditLogs     AuditLog[]\n\n  @@index([email, role, status])\n  @@index([isDeleted])\n  @@map("users")\n}\n\nmodel DonorProfile {\n  id               String      @id @default(uuid())\n  userId           String      @unique\n  user             User        @relation(fields: [userId], references: [id], onDelete: Cascade)\n  bloodGroup       BloodGroup?\n  isAvailable      Boolean     @default(true)\n  lastDonationDate DateTime?\n  totalDonations   Int         @default(0)\n  phone            String?\n  address          String?\n  latitude         Float?\n  longitude        Float?\n  createdAt        DateTime    @default(now())\n  updatedAt        DateTime    @updatedAt\n\n  @@index([bloodGroup, isAvailable])\n  @@index([lastDonationDate])\n  @@map("donor_profiles")\n}\n',
  "runtimeDataModel": {
    "models": {},
    "enums": {},
    "types": {}
  },
  "parameterizationSchema": {
    "strings": [],
    "graph": ""
  }
};
config.runtimeDataModel = JSON.parse('{"models":{"BloodRequest":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"requesterId","kind":"scalar","type":"String"},{"name":"requester","kind":"object","type":"User","relationName":"BloodRequestToUser"},{"name":"patientName","kind":"scalar","type":"String"},{"name":"bloodGroup","kind":"enum","type":"BloodGroup"},{"name":"unitsNeeded","kind":"scalar","type":"Int"},{"name":"unitsFulfilled","kind":"scalar","type":"Int"},{"name":"hospitalName","kind":"scalar","type":"String"},{"name":"hospitalAddress","kind":"scalar","type":"String"},{"name":"latitude","kind":"scalar","type":"Float"},{"name":"longitude","kind":"scalar","type":"Float"},{"name":"contactNumber","kind":"scalar","type":"String"},{"name":"urgency","kind":"enum","type":"UrgencyLevel"},{"name":"status","kind":"enum","type":"RequestStatus"},{"name":"notes","kind":"scalar","type":"String"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"deletedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"assignments","kind":"object","type":"DonationAssignment","relationName":"BloodRequestToDonationAssignment"},{"name":"payments","kind":"object","type":"Payment","relationName":"BloodRequestToPayment"}],"dbName":"blood_requests","schema":null},"DonationAssignment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"requestId","kind":"scalar","type":"String"},{"name":"request","kind":"object","type":"BloodRequest","relationName":"BloodRequestToDonationAssignment"},{"name":"donorId","kind":"scalar","type":"String"},{"name":"donor","kind":"object","type":"User","relationName":"DonationAssignmentToUser"},{"name":"status","kind":"enum","type":"DonationStatus"},{"name":"notes","kind":"scalar","type":"String"},{"name":"completedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"donation_assignments","schema":null},"Payment":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"requestId","kind":"scalar","type":"String"},{"name":"request","kind":"object","type":"BloodRequest","relationName":"BloodRequestToPayment"},{"name":"payerId","kind":"scalar","type":"String"},{"name":"payer","kind":"object","type":"User","relationName":"PaymentToUser"},{"name":"amount","kind":"scalar","type":"Float"},{"name":"amountMinor","kind":"scalar","type":"Int"},{"name":"currency","kind":"scalar","type":"String"},{"name":"paymentMethod","kind":"enum","type":"PaymentMethod"},{"name":"paymentId","kind":"scalar","type":"String"},{"name":"transactionId","kind":"scalar","type":"String"},{"name":"status","kind":"enum","type":"PaymentStatus"},{"name":"paymentExecuteResponse","kind":"scalar","type":"Json"},{"name":"merchantInvoiceNumber","kind":"scalar","type":"String"},{"name":"checkoutUrl","kind":"scalar","type":"String"},{"name":"idempotencyKey","kind":"scalar","type":"String"},{"name":"initiationFingerprint","kind":"scalar","type":"String"},{"name":"failureReason","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"payments","schema":null},"PaymentWebhookEvent":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"type","kind":"scalar","type":"String"},{"name":"processedAt","kind":"scalar","type":"DateTime"}],"dbName":"payment_webhook_events","schema":null},"AuditLog":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"AuditLogToUser"},{"name":"action","kind":"scalar","type":"String"},{"name":"resource","kind":"scalar","type":"String"},{"name":"resourceId","kind":"scalar","type":"String"},{"name":"details","kind":"scalar","type":"Json"},{"name":"ipAddress","kind":"scalar","type":"String"},{"name":"createdAt","kind":"scalar","type":"DateTime"}],"dbName":"audit_logs","schema":null},"User":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"name","kind":"scalar","type":"String"},{"name":"email","kind":"scalar","type":"String"},{"name":"password","kind":"scalar","type":"String"},{"name":"role","kind":"enum","type":"Role"},{"name":"status","kind":"enum","type":"UserStatus"},{"name":"googleId","kind":"scalar","type":"String"},{"name":"phone","kind":"scalar","type":"String"},{"name":"address","kind":"scalar","type":"String"},{"name":"isDeleted","kind":"scalar","type":"Boolean"},{"name":"deletedAt","kind":"scalar","type":"DateTime"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"},{"name":"donorProfile","kind":"object","type":"DonorProfile","relationName":"DonorProfileToUser"},{"name":"bloodRequests","kind":"object","type":"BloodRequest","relationName":"BloodRequestToUser"},{"name":"assignments","kind":"object","type":"DonationAssignment","relationName":"DonationAssignmentToUser"},{"name":"payments","kind":"object","type":"Payment","relationName":"PaymentToUser"},{"name":"auditLogs","kind":"object","type":"AuditLog","relationName":"AuditLogToUser"}],"dbName":"users","schema":null},"DonorProfile":{"fields":[{"name":"id","kind":"scalar","type":"String"},{"name":"userId","kind":"scalar","type":"String"},{"name":"user","kind":"object","type":"User","relationName":"DonorProfileToUser"},{"name":"bloodGroup","kind":"enum","type":"BloodGroup"},{"name":"isAvailable","kind":"scalar","type":"Boolean"},{"name":"lastDonationDate","kind":"scalar","type":"DateTime"},{"name":"totalDonations","kind":"scalar","type":"Int"},{"name":"phone","kind":"scalar","type":"String"},{"name":"address","kind":"scalar","type":"String"},{"name":"latitude","kind":"scalar","type":"Float"},{"name":"longitude","kind":"scalar","type":"Float"},{"name":"createdAt","kind":"scalar","type":"DateTime"},{"name":"updatedAt","kind":"scalar","type":"DateTime"}],"dbName":"donor_profiles","schema":null}},"enums":{},"types":{}}');
config.parameterizationSchema = {
  strings: JSON.parse('["where","user","donorProfile","orderBy","cursor","bloodRequests","request","donor","assignments","payer","payments","auditLogs","_count","requester","BloodRequest.findUnique","BloodRequest.findUniqueOrThrow","BloodRequest.findFirst","BloodRequest.findFirstOrThrow","BloodRequest.findMany","data","BloodRequest.createOne","BloodRequest.createMany","BloodRequest.createManyAndReturn","BloodRequest.updateOne","BloodRequest.updateMany","BloodRequest.updateManyAndReturn","create","update","BloodRequest.upsertOne","BloodRequest.deleteOne","BloodRequest.deleteMany","having","_avg","_sum","_min","_max","BloodRequest.groupBy","BloodRequest.aggregate","DonationAssignment.findUnique","DonationAssignment.findUniqueOrThrow","DonationAssignment.findFirst","DonationAssignment.findFirstOrThrow","DonationAssignment.findMany","DonationAssignment.createOne","DonationAssignment.createMany","DonationAssignment.createManyAndReturn","DonationAssignment.updateOne","DonationAssignment.updateMany","DonationAssignment.updateManyAndReturn","DonationAssignment.upsertOne","DonationAssignment.deleteOne","DonationAssignment.deleteMany","DonationAssignment.groupBy","DonationAssignment.aggregate","Payment.findUnique","Payment.findUniqueOrThrow","Payment.findFirst","Payment.findFirstOrThrow","Payment.findMany","Payment.createOne","Payment.createMany","Payment.createManyAndReturn","Payment.updateOne","Payment.updateMany","Payment.updateManyAndReturn","Payment.upsertOne","Payment.deleteOne","Payment.deleteMany","Payment.groupBy","Payment.aggregate","PaymentWebhookEvent.findUnique","PaymentWebhookEvent.findUniqueOrThrow","PaymentWebhookEvent.findFirst","PaymentWebhookEvent.findFirstOrThrow","PaymentWebhookEvent.findMany","PaymentWebhookEvent.createOne","PaymentWebhookEvent.createMany","PaymentWebhookEvent.createManyAndReturn","PaymentWebhookEvent.updateOne","PaymentWebhookEvent.updateMany","PaymentWebhookEvent.updateManyAndReturn","PaymentWebhookEvent.upsertOne","PaymentWebhookEvent.deleteOne","PaymentWebhookEvent.deleteMany","PaymentWebhookEvent.groupBy","PaymentWebhookEvent.aggregate","AuditLog.findUnique","AuditLog.findUniqueOrThrow","AuditLog.findFirst","AuditLog.findFirstOrThrow","AuditLog.findMany","AuditLog.createOne","AuditLog.createMany","AuditLog.createManyAndReturn","AuditLog.updateOne","AuditLog.updateMany","AuditLog.updateManyAndReturn","AuditLog.upsertOne","AuditLog.deleteOne","AuditLog.deleteMany","AuditLog.groupBy","AuditLog.aggregate","User.findUnique","User.findUniqueOrThrow","User.findFirst","User.findFirstOrThrow","User.findMany","User.createOne","User.createMany","User.createManyAndReturn","User.updateOne","User.updateMany","User.updateManyAndReturn","User.upsertOne","User.deleteOne","User.deleteMany","User.groupBy","User.aggregate","DonorProfile.findUnique","DonorProfile.findUniqueOrThrow","DonorProfile.findFirst","DonorProfile.findFirstOrThrow","DonorProfile.findMany","DonorProfile.createOne","DonorProfile.createMany","DonorProfile.createManyAndReturn","DonorProfile.updateOne","DonorProfile.updateMany","DonorProfile.updateManyAndReturn","DonorProfile.upsertOne","DonorProfile.deleteOne","DonorProfile.deleteMany","DonorProfile.groupBy","DonorProfile.aggregate","AND","OR","NOT","id","userId","BloodGroup","bloodGroup","isAvailable","lastDonationDate","totalDonations","phone","address","latitude","longitude","createdAt","updatedAt","equals","in","notIn","lt","lte","gt","gte","not","contains","startsWith","endsWith","name","email","password","Role","role","UserStatus","status","googleId","isDeleted","deletedAt","every","some","none","action","resource","resourceId","details","ipAddress","string_contains","string_starts_with","string_ends_with","array_starts_with","array_ends_with","array_contains","type","processedAt","requestId","payerId","amount","amountMinor","currency","PaymentMethod","paymentMethod","paymentId","transactionId","PaymentStatus","paymentExecuteResponse","merchantInvoiceNumber","checkoutUrl","idempotencyKey","initiationFingerprint","failureReason","donorId","DonationStatus","notes","completedAt","requesterId","patientName","unitsNeeded","unitsFulfilled","hospitalName","hospitalAddress","contactNumber","UrgencyLevel","urgency","RequestStatus","payerId_idempotencyKey","requestId_donorId","is","isNot","connectOrCreate","upsert","createMany","set","disconnect","delete","connect","updateMany","deleteMany","increment","decrement","multiply","divide"]'),
  graph: "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-QEAMIcBAABcABCIAQAA-QEAMIkBAQDBAQAhlAFAAMgBACGVAUAAyAEAIacBAAD8AcUBIrsBAQDBAQAhvAEBAMEBACG9AQgA-gEAIb4BAgDFAQAhvwEBAMEBACHBAQAA-wHBASLCAQEAwQEAIcMBAQDGAQAhxQEAAPUBACDGAQEAxgEAIccBAQDGAQAhyAEBAMYBACHJAQEAxgEAIcoBAQDGAQAhAwAAAAwAIAMAAFsAMB8AAFwAIAMAAAAMACADAAANADAEAAAOACAGhgEAAPgBADCHAQAAYgAQiAEAAPgBADCJAQEAAAABuQEBAOwBACG6AUAA4gEAIQEAAABfACABAAAAXwAgBoYBAAD4AQAwhwEAAGIAEIgBAAD4AQAwiQEBAOwBACG5AQEA7AEAIboBQADiAQAhAAMAAABiACADAABjADAEAABfACADAAAAYgAgAwAAYwAwBAAAXwAgAwAAAGIAIAMAAGMAMAQAAF8AIAOJAQEAAAABuQEBAAAAAboBQAAAAAEBEwAAZwAgA4kBAQAAAAG5AQEAAAABugFAAAAAAQETAABpADABEwAAaQAwA4kBAQCmAgAhuQEBAKYCACG6AUAArQIAIQIAAABfACATAABsACADiQEBAKYCACG5AQEApgIAIboBQACtAgAhAgAAAGIAIBMAAG4AIAIAAABiACATAABuACADAAAAXwAgGgAAZwAgGwAAbAAgAQAAAF8AIAEAAABiACADDAAApAMAICIAAKYDACAjAAClAwAgBoYBAAD3AQAwhwEAAHUAEIgBAAD3AQAwiQEBAMEBACG5AQEAwQEAIboBQADIAQAhAwAAAGIAIAMAAHQAMB8AAHUAIAMAAABiACADAABjADAEAABfACABAAAAEgAgAQAAABIAIAMAAAAQACADAAARADAEAAASACADAAAAEAAgAwAAEQAwBAAAEgAgAwAAABAAIAMAABEAMAQAABIAIAkBAACjAwAgiQEBAAAAAYoBAQAAAAGUAUAAAAABrgEBAAAAAa8BAQAAAAGwAQEAAAABsQGAAAAAAbIBAQAAAAEBEwAAfQAgCIkBAQAAAAGKAQEAAAABlAFAAAAAAa4BAQAAAAGvAQEAAAABsAEBAAAAAbEBgAAAAAGyAQEAAAABARMAAH8AMAETAAB_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_AHFASK7AQEAwQEAIbwBAQDBAQAhvQEIAPoBACG-AQIAxQEAIb8BAQDBAQAhwQEAAPsBwQEiwgEBAMEBACHDAQEAxgEAIcUBAAD1AQAgxgEBAMYBACHHAQEAxgEAIcgBAQDGAQAhyQEBAMYBACHKAQEAxgEAIQ0MAADKAQAgIAAA0gEAICEAANIBACAiAADSAQAgIwAA0gEAIJYBCAAAAAGXAQgAAAAEmAEIAAAABJkBCAAAAAGaAQgAAAABmwEIAAAAAZwBCAAAAAGdAQgAgQIAIQcMAADKAQAgIgAAgAIAICMAAIACACCWAQAAAMEBApcBAAAAwQEImAEAAADBAQidAQAA_wHBASIHDAAAygEAICIAAP4BACAjAAD-AQAglgEAAADFAQKXAQAAAMUBCJgBAAAAxQEInQEAAP0BxQEiBwwAAMoBACAiAAD-AQAgIwAA_gEAIJYBAAAAxQEClwEAAADFAQiYAQAAAMUBCJ0BAAD9AcUBIgSWAQAAAMUBApcBAAAAxQEImAEAAADFAQidAQAA_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_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_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-wIAMN0BAAD4AgAw3gEAAPkCADDfAQAA-gIAIOABAADLAgAw4QEAAMsCADDiAQAAywIAMOMBAADLAgAw5AEAAPwCADDlAQAAzgIAMBIJAACBAwAgiQEBAAAAAZQBQAAAAAGVAUAAAAABpwEAAADFAQK8AQEAAAABvQEIAAAAAb4BAgAAAAG_AQEAAAABwQEAAADBAQLCAQEAAAABwwEBAAAAAcUBgAAAAAHGAQEAAAABxwEBAAAAAcgBAQAAAAHJAQEAAAABygEBAAAAAQIAAAAOACAaAACAAwAgAwAAAA4AIBoAAIADACAbAAD-AgAgARMAAMwDADACAAAADgAgEwAA_gIAIAIAAADPAgAgEwAA_QIAIBGJAQEApgIAIZQBQACtAgAhlQFAAK0CACGnAQAA0wLFASK8AQEApgIAIb0BCADRAgAhvgECAKoCACG_AQEApgIAIcEBAADSAsEBIsIBAQCmAgAhwwEBAKsCACHFAYAAAAABxgEBAKsCACHHAQEAqwIAIcgBAQCrAgAhyQEBAKsCACHKAQEAqwIAIRIJAAD_AgAgiQEBAKYCACGUAUAArQIAIZUBQACtAgAhpwEAANMCxQEivAEBAKYCACG9AQgA0QIAIb4BAgCqAgAhvwEBAKYCACHBAQAA0gLBASLCAQEApgIAIcMBAQCrAgAhxQGAAAAAAcYBAQCrAgAhxwEBAKsCACHIAQEAqwIAIckBAQCrAgAhygEBAKsCACEFGgAAxwMAIBsAAMoDACDdAQAAyAMAIN4BAADJAwAg4wEAAJABACASCQAAgQMAIIkBAQAAAAGUAUAAAAABlQFAAAAAAacBAAAAxQECvAEBAAAAAb0BCAAAAAG-AQIAAAABvwEBAAAAAcEBAAAAwQECwgEBAAAAAcMBAQAAAAHFAYAAAAABxgEBAAAAAccBAQAAAAHIAQEAAAAByQEBAAAAAcoBAQAAAAEDGgAAxwMAIN0BAADIAwAg4wEAAJABACAIBwAAjAMAIIkBAQAAAAGUAUAAAAABlQFAAAAAAacBAAAAzQECywEBAAAAAc0BAQAAAAHOAUAAAAABAgAAAAoAIBoAAIsDACADAAAACgAgGgAAiwMAIBsAAIkDACABEwAAxgMAMAIAAAAKACATAACJAwAgAgAAAOACACATAACIAwAgB4kBAQCmAgAhlAFAAK0CACGVAUAArQIAIacBAADiAs0BIssBAQCmAgAhzQEBAKsCACHOAUAAqQIAIQgHAACKAwAgiQEBAKYCACGUAUAArQIAIZUBQACtAgAhpwEAAOICzQEiywEBAKYCACHNAQEAqwIAIc4BQACpAgAhBRoAAMEDACAbAADEAwAg3QEAAMIDACDeAQAAwwMAIOMBAACQAQAgCAcAAIwDACCJAQEAAAABlAFAAAAAAZUBQAAAAAGnAQAAAM0BAssBAQAAAAHNAQEAAAABzgFAAAAAAQMaAADBAwAg3QEAAMIDACDjAQAAkAEAIBMIAACOAwAgCgAAjwMAIIkBAQAAAAGMAQAAAIwBApIBCAAAAAGTAQgAAAABlAFAAAAAAZUBQAAAAAGnAQAAANkBAqkBIAAAAAGqAUAAAAABzQEBAAAAAdABAQAAAAHRAQIAAAAB0gECAAAAAdMBAQAAAAHUAQEAAAAB1QEBAAAAAdcBAAAA1wECBBoAAIIDADDdAQAAgwMAMN8BAACFAwAg4wEAANwCADAEGgAA9wIAMN0BAAD4AgAw3wEAAPoCACDjAQAAywIAMAuJAQEAAAABjAEAAACMAQONASAAAAABjgFAAAAAAY8BAgAAAAGQAQEAAAABkQEBAAAAAZIBCAAAAAGTAQgAAAABlAFAAAAAAZUBQAAAAAECAAAAqAEAIBoAAJADACADAAAAAwAgGgAAkAMAIBsAAJQDACANAAAAAwAgEwAAlAMAIIkBAQCmAgAhjAEAAKcCjAEjjQEgAKgCACGOAUAAqQIAIY8BAgCqAgAhkAEBAKsCACGRAQEAqwIAIZIBCACsAgAhkwEIAKwCACGUAUAArQIAIZUBQACtAgAhC4kBAQCmAgAhjAEAAKcCjAEjjQEgAKgCACGOAUAAqQIAIY8BAgCqAgAhkAEBAKsCACGRAQEAqwIAIZIBCACsAgAhkwEIAKwCACGUAUAArQIAIZUBQACtAgAhAxoAAJADACDdAQAAkQMAIOMBAACoAQAgBBoAAOcCADDdAQAA6AIAMN8BAADqAgAg4wEAAOsCADAEGgAA2AIAMN0BAADZAgAw3wEAANsCACDjAQAA3AIAMAQaAADHAgAw3QEAAMgCADDfAQAAygIAIOMBAADLAgAwBBoAALsCADDdAQAAvAIAMN8BAAC-AgAg4wEAAL8CADAHAQAAsAIAIIwBAACgAgAgjgEAAKACACCQAQAAoAIAIJEBAACgAgAgkgEAAKACACCTAQAAoAIAIAAAAAAAAAAHGgAAvAMAIBsAAL8DACDdAQAAvQMAIN4BAAC-AwAg4QEAABQAIOIBAAAUACDjAQAAkAEAIAMaAAC8AwAg3QEAAL0DACDjAQAAkAEAIAAAAAAAAAAAAAAAAAAAAAAFGgAAtwMAIBsAALoDACDdAQAAuAMAIN4BAAC5AwAg4wEAAJABACADGgAAtwMAIN0BAAC4AwAg4wEAAJABACAFCAAAnAMAIAoAAJ0DACANAACwAgAgqgEAAKACACDNAQAAoAIAIBECAACVAwAgCAAAlwMAIAoAAJgDACALAACZAwAgiQEBAAAAAZABAQAAAAGRAQEAAAABlAFAAAAAAZUBQAAAAAGhAQEAAAABogEBAAAAAaMBAQAAAAGlAQAAAKUBAqcBAAAApwECqAEBAAAAAakBIAAAAAGqAUAAAAABAgAAAJABACAaAAC3AwAgAwAAABQAIBoAALcDACAbAAC7AwAgEwAAABQAIAIAALYCACAIAAC4AgAgCgAAuQIAIAsAALoCACATAAC7AwAgiQEBAKYCACGQAQEAqwIAIZEBAQCrAgAhlAFAAK0CACGVAUAArQIAIaEBAQCmAgAhogEBAKYCACGjAQEAqwIAIaUBAAC0AqUBIqcBAAC1AqcBIqgBAQCrAgAhqQEgAKgCACGqAUAAqQIAIRECAAC2AgAgCAAAuAIAIAoAALkCACALAAC6AgAgiQEBAKYCACGQAQEAqwIAIZEBAQCrAgAhlAFAAK0CACGVAUAArQIAIaEBAQCmAgAhogEBAKYCACGjAQEAqwIAIaUBAAC0AqUBIqcBAAC1AqcBIqgBAQCrAgAhqQEgAKgCACGqAUAAqQIAIRECAACVAwAgBQAAlgMAIAgAAJcDACAKAACYAwAgiQEBAAAAAZABAQAAAAGRAQEAAAABlAFAAAAAAZUBQAAAAAGhAQEAAAABogEBAAAAAaMBAQAAAAGlAQAAAKUBAqcBAAAApwECqAEBAAAAAakBIAAAAAGqAUAAAAABAgAAAJABACAaAAC8AwAgAwAAABQAIBoAALwDACAbAADAAwAgEwAAABQAIAIAALYCACAFAAC3AgAgCAAAuAIAIAoAALkCACATAADAAwAgiQEBAKYCACGQAQEAqwIAIZEBAQCrAgAhlAFAAK0CACGVAUAArQIAIaEBAQCmAgAhogEBAKYCACGjAQEAqwIAIaUBAAC0AqUBIqcBAAC1AqcBIqgBAQCrAgAhqQEg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-VAU_VglAVxtBWAVCWQVDWglEXRxFXiJGYCNHYSNIZCNJZSNKZiNLaCNMaglNayRObSNPbwlQcCVRcSNSciNTcwlUdiZVdypWeAZXeQZYegZZewZafAZbfgZcgAEJXYEBK16EAQZfhgEJYIcBLGGJAQZiigEGY4sBCWSOAS1ljwExZpEBAmeSAQJolAECaZUBAmqWAQJrmAECbJoBCW2bATJunQECb58BCXCgATNxoQECcqIBAnOjAQl0pgE0dacBOHapAQN3qgEDeKwBA3mtAQN6rgEDe7ABA3yyAQl9swE5frUBA3-3AQmAAbgBOoEBuQEDggG6AQODAbsBCYQBvgE7hQG_AUE"
};
async function decodeBase64AsWasm(wasmBase64) {
  const { Buffer: Buffer2 } = await import("buffer");
  const wasmArray = Buffer2.from(wasmBase64, "base64");
  return new WebAssembly.Module(wasmArray);
}
config.compilerWasm = {
  getRuntime: async () => await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.mjs"),
  getQueryCompilerWasmModule: async () => {
    const { wasm } = await import("@prisma/client/runtime/query_compiler_fast_bg.postgresql.wasm-base64.mjs");
    return await decodeBase64AsWasm(wasm);
  },
  importName: "./query_compiler_fast_bg.js"
};
function getPrismaClientClass() {
  return runtime.getPrismaClient(config);
}

// src/generated/prisma/internal/prismaNamespace.ts
var prismaNamespace_exports = {};
__export(prismaNamespace_exports, {
  AnyNull: () => AnyNull2,
  AuditLogScalarFieldEnum: () => AuditLogScalarFieldEnum,
  BloodRequestScalarFieldEnum: () => BloodRequestScalarFieldEnum,
  DbNull: () => DbNull2,
  Decimal: () => Decimal2,
  DonationAssignmentScalarFieldEnum: () => DonationAssignmentScalarFieldEnum,
  DonorProfileScalarFieldEnum: () => DonorProfileScalarFieldEnum,
  JsonNull: () => JsonNull2,
  JsonNullValueFilter: () => JsonNullValueFilter,
  ModelName: () => ModelName,
  NullTypes: () => NullTypes2,
  NullableJsonNullValueInput: () => NullableJsonNullValueInput,
  NullsOrder: () => NullsOrder,
  PaymentScalarFieldEnum: () => PaymentScalarFieldEnum,
  PaymentWebhookEventScalarFieldEnum: () => PaymentWebhookEventScalarFieldEnum,
  PrismaClientInitializationError: () => PrismaClientInitializationError2,
  PrismaClientKnownRequestError: () => PrismaClientKnownRequestError2,
  PrismaClientRustPanicError: () => PrismaClientRustPanicError2,
  PrismaClientUnknownRequestError: () => PrismaClientUnknownRequestError2,
  PrismaClientValidationError: () => PrismaClientValidationError2,
  QueryMode: () => QueryMode,
  SortOrder: () => SortOrder,
  Sql: () => Sql2,
  TransactionIsolationLevel: () => TransactionIsolationLevel,
  UserScalarFieldEnum: () => UserScalarFieldEnum,
  defineExtension: () => defineExtension,
  empty: () => empty2,
  getExtensionContext: () => getExtensionContext,
  join: () => join2,
  prismaVersion: () => prismaVersion,
  raw: () => raw2,
  sql: () => sql
});
import * as runtime2 from "@prisma/client/runtime/client";
var PrismaClientKnownRequestError2 = runtime2.PrismaClientKnownRequestError;
var PrismaClientUnknownRequestError2 = runtime2.PrismaClientUnknownRequestError;
var PrismaClientRustPanicError2 = runtime2.PrismaClientRustPanicError;
var PrismaClientInitializationError2 = runtime2.PrismaClientInitializationError;
var PrismaClientValidationError2 = runtime2.PrismaClientValidationError;
var sql = runtime2.sqltag;
var empty2 = runtime2.empty;
var join2 = runtime2.join;
var raw2 = runtime2.raw;
var Sql2 = runtime2.Sql;
var Decimal2 = runtime2.Decimal;
var getExtensionContext = runtime2.Extensions.getExtensionContext;
var prismaVersion = {
  client: "7.10.0",
  engine: "0edf323efd1d98336f3f0a68684b56f689b900d3"
};
var NullTypes2 = {
  DbNull: runtime2.NullTypes.DbNull,
  JsonNull: runtime2.NullTypes.JsonNull,
  AnyNull: runtime2.NullTypes.AnyNull
};
var DbNull2 = runtime2.DbNull;
var JsonNull2 = runtime2.JsonNull;
var AnyNull2 = runtime2.AnyNull;
var ModelName = {
  BloodRequest: "BloodRequest",
  DonationAssignment: "DonationAssignment",
  Payment: "Payment",
  PaymentWebhookEvent: "PaymentWebhookEvent",
  AuditLog: "AuditLog",
  User: "User",
  DonorProfile: "DonorProfile"
};
var TransactionIsolationLevel = runtime2.makeStrictEnum({
  ReadUncommitted: "ReadUncommitted",
  ReadCommitted: "ReadCommitted",
  RepeatableRead: "RepeatableRead",
  Serializable: "Serializable"
});
var BloodRequestScalarFieldEnum = {
  id: "id",
  requesterId: "requesterId",
  patientName: "patientName",
  bloodGroup: "bloodGroup",
  unitsNeeded: "unitsNeeded",
  unitsFulfilled: "unitsFulfilled",
  hospitalName: "hospitalName",
  hospitalAddress: "hospitalAddress",
  latitude: "latitude",
  longitude: "longitude",
  contactNumber: "contactNumber",
  urgency: "urgency",
  status: "status",
  notes: "notes",
  isDeleted: "isDeleted",
  deletedAt: "deletedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var DonationAssignmentScalarFieldEnum = {
  id: "id",
  requestId: "requestId",
  donorId: "donorId",
  status: "status",
  notes: "notes",
  completedAt: "completedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var PaymentScalarFieldEnum = {
  id: "id",
  requestId: "requestId",
  payerId: "payerId",
  amount: "amount",
  amountMinor: "amountMinor",
  currency: "currency",
  paymentMethod: "paymentMethod",
  paymentId: "paymentId",
  transactionId: "transactionId",
  status: "status",
  paymentExecuteResponse: "paymentExecuteResponse",
  merchantInvoiceNumber: "merchantInvoiceNumber",
  checkoutUrl: "checkoutUrl",
  idempotencyKey: "idempotencyKey",
  initiationFingerprint: "initiationFingerprint",
  failureReason: "failureReason",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var PaymentWebhookEventScalarFieldEnum = {
  id: "id",
  type: "type",
  processedAt: "processedAt"
};
var AuditLogScalarFieldEnum = {
  id: "id",
  userId: "userId",
  action: "action",
  resource: "resource",
  resourceId: "resourceId",
  details: "details",
  ipAddress: "ipAddress",
  createdAt: "createdAt"
};
var UserScalarFieldEnum = {
  id: "id",
  name: "name",
  email: "email",
  password: "password",
  role: "role",
  status: "status",
  googleId: "googleId",
  phone: "phone",
  address: "address",
  isDeleted: "isDeleted",
  deletedAt: "deletedAt",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var DonorProfileScalarFieldEnum = {
  id: "id",
  userId: "userId",
  bloodGroup: "bloodGroup",
  isAvailable: "isAvailable",
  lastDonationDate: "lastDonationDate",
  totalDonations: "totalDonations",
  phone: "phone",
  address: "address",
  latitude: "latitude",
  longitude: "longitude",
  createdAt: "createdAt",
  updatedAt: "updatedAt"
};
var SortOrder = {
  asc: "asc",
  desc: "desc"
};
var NullableJsonNullValueInput = {
  DbNull: DbNull2,
  JsonNull: JsonNull2
};
var QueryMode = {
  default: "default",
  insensitive: "insensitive"
};
var NullsOrder = {
  first: "first",
  last: "last"
};
var JsonNullValueFilter = {
  DbNull: DbNull2,
  JsonNull: JsonNull2,
  AnyNull: AnyNull2
};
var defineExtension = runtime2.Extensions.defineExtension;

// src/generated/prisma/enums.ts
var Role = {
  DONOR: "DONOR",
  RECIPIENT: "RECIPIENT",
  ADMIN: "ADMIN"
};
var UserStatus = {
  ACTIVE: "ACTIVE",
  BLOCKED: "BLOCKED"
};
var BloodGroup = {
  A_POSITIVE: "A_POSITIVE",
  A_NEGATIVE: "A_NEGATIVE",
  B_POSITIVE: "B_POSITIVE",
  B_NEGATIVE: "B_NEGATIVE",
  AB_POSITIVE: "AB_POSITIVE",
  AB_NEGATIVE: "AB_NEGATIVE",
  O_POSITIVE: "O_POSITIVE",
  O_NEGATIVE: "O_NEGATIVE"
};
var UrgencyLevel = {
  NORMAL: "NORMAL",
  URGENT: "URGENT",
  CRITICAL: "CRITICAL"
};
var RequestStatus = {
  OPEN: "OPEN",
  MATCHED: "MATCHED",
  FULFILLED: "FULFILLED",
  CANCELLED: "CANCELLED"
};
var DonationStatus = {
  ASSIGNED: "ASSIGNED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};
var PaymentStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED"
};
var PaymentMethod = {
  BKASH: "BKASH",
  STRIPE: "STRIPE"
};

// src/generated/prisma/client.ts
globalThis["__dirname"] = path2.dirname(fileURLToPath(import.meta.url));
var PrismaClient = getPrismaClientClass();

// src/app/utils/AppError.ts
var AppError = class extends Error {
  statusCode;
  constructor(statusCode, message, stack = "") {
    super(message);
    this.statusCode = statusCode;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
};

// src/app/middleware/globalErrorHandler.ts
var globalErrorHandler = (err, _req, res, _next) => {
  let statusCode = httpStatus.INTERNAL_SERVER_ERROR;
  let message = "Something went wrong";
  let errors = [];
  if (err instanceof ZodError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Validation Error";
    errors = err.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join(".") : void 0,
      message: issue.message
    }));
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = [{ message: err.message }];
  } else if (err instanceof prismaNamespace_exports.PrismaClientValidationError) {
    statusCode = httpStatus.BAD_REQUEST;
    message = "Prisma validation error: Invalid field types or missing fields";
    errors = [{ message: err.message }];
  } else if (err instanceof prismaNamespace_exports.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      statusCode = httpStatus.CONFLICT;
      message = "Duplicate key error: A record with this value already exists";
      errors = [
        {
          field: err.meta?.target?.join(".") || "field",
          message: "Must be unique"
        }
      ];
    } else if (err.code === "P2025") {
      statusCode = httpStatus.NOT_FOUND;
      message = "Requested record not found";
      errors = [{ message: "Record not found" }];
    } else if (err.code === "P2003") {
      statusCode = httpStatus.BAD_REQUEST;
      message = "Foreign key constraint failure";
      errors = [{ message: "Foreign key reference failed" }];
    } else {
      statusCode = httpStatus.BAD_REQUEST;
      message = err.message || "Database query error";
      errors = [{ message: err.message }];
    }
  } else if (err instanceof Error) {
    statusCode = httpStatus.BAD_REQUEST;
    message = err.message || "Something went wrong";
    errors = [{ message: err.message }];
  }
  res.status(statusCode).json({
    success: false,
    message,
    errors
  });
};

// src/app/middleware/notFound.ts
import httpStatus2 from "http-status";
var notFound = (req, res) => {
  res.status(httpStatus2.NOT_FOUND).json({
    success: false,
    message: "API endpoint not found",
    errors: [
      {
        field: "path",
        message: `Route not found: ${req.originalUrl}`
      }
    ]
  });
};

// src/app/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";
import httpStatus3 from "http-status";
var globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: httpStatus3.TOO_MANY_REQUESTS,
  message: {
    success: false,
    message: "Too many requests from this IP address. Please try again after 15 minutes.",
    errors: [
      {
        message: "Rate limit exceeded. Maximum 100 requests per 15 minutes."
      }
    ]
  }
});
var authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: httpStatus3.TOO_MANY_REQUESTS,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again after 15 minutes.",
    errors: [
      {
        message: "Authentication rate limit exceeded to protect against brute-force attacks."
      }
    ]
  }
});

// src/app/module/admin/admin.route.ts
import { Router } from "express";

// src/app/middleware/checkAuth.ts
import httpStatus4 from "http-status";

// src/app/lib/prisma.ts
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
var connectionString = process.env.DATABASE_URL || "";
var createPrismaClient = () => {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
};
var prisma = globalThis.__prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

// src/app/utils/catchAsync.ts
var catchAsync = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

// src/app/utils/jwt.ts
import jwt from "jsonwebtoken";
var createToken = (payload, secret, expiresIn) => {
  const token = jwt.sign(payload, secret, {
    expiresIn
  });
  return token;
};
var verifyToken = (token, secret) => {
  try {
    const verifiedToken = jwt.verify(token, secret);
    return {
      success: true,
      data: verifiedToken
    };
  } catch (error) {
    console.log("Token verification failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
};
var jwtUtils = {
  createToken,
  verifyToken
};

// src/app/middleware/checkAuth.ts
var auth = (...requiredRoles) => {
  return catchAsync(
    async (req, _res, next) => {
      const token = req.cookies.accessToken ? req.cookies.accessToken : req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : req.headers.authorization;
      if (!token) {
        throw new AppError(
          httpStatus4.UNAUTHORIZED,
          "You are not logged in. Please log in to access this resource."
        );
      }
      const verifiedToken = jwtUtils.verifyToken(
        token,
        config_default.jwt_access_secret
      );
      if (!verifiedToken.success) {
        throw new AppError(
          httpStatus4.UNAUTHORIZED,
          "Invalid or expired access token"
        );
      }
      const { userId, email, name, role } = verifiedToken.data;
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      if (!user || user.isDeleted) {
        throw new AppError(
          httpStatus4.UNAUTHORIZED,
          "User account not found or deleted"
        );
      }
      if (user.status === "BLOCKED") {
        throw new AppError(
          httpStatus4.FORBIDDEN,
          "Your account has been suspended by administration"
        );
      }
      if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
        throw new AppError(
          httpStatus4.FORBIDDEN,
          "Forbidden. You do not have permission to perform this action"
        );
      }
      req.user = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };
      next();
    }
  );
};

// src/app/middleware/validateRequest.ts
var validateRequest = (schema) => {
  return async (req, _res, next) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
        cookies: req.cookies
      });
      if (parsed && typeof parsed === "object") {
        if ("body" in parsed && parsed.body !== void 0) {
          req.body = parsed.body;
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};

// src/app/module/admin/admin.controller.ts
import httpStatus6 from "http-status";

// src/app/utils/sendResponse.ts
var sendResponse = (res, payload) => {
  res.status(payload.statusCode).json({
    success: payload.success ?? true,
    message: payload.message,
    data: payload.data
  });
};

// src/app/module/admin/admin.query.ts
import { z } from "zod";
var positiveInteger = (maximum, fallback) => z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().min(1).max(maximum)).default(fallback);
var text = (maximum) => z.string().trim().min(1).max(maximum);
var ADMIN_USER_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "name",
  "email",
  "role",
  "status"
];
var AUDIT_LOG_SORT_FIELDS = [
  "createdAt",
  "action",
  "resource"
];
var adminUsersQuerySchema = z.object({
  page: positiveInteger(1e6, 1),
  limit: positiveInteger(100, 10),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  searchTerm: text(100).optional(),
  sortBy: z.enum(ADMIN_USER_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
}).strict();
var auditLogsQuerySchema = z.object({
  page: positiveInteger(1e6, 1),
  limit: positiveInteger(100, 20),
  action: text(100).optional(),
  resource: text(100).optional(),
  sortBy: z.enum(AUDIT_LOG_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
}).strict();

// src/app/module/admin/admin.service.ts
import httpStatus5 from "http-status";

// src/app/lib/redis.ts
import Redis from "ioredis";
var MemoryCache = class {
  store = /* @__PURE__ */ new Map();
  get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }
  set(key, value, ttlSeconds) {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1e3 : void 0;
    this.store.set(key, { value, expiresAt });
  }
  del(key) {
    this.store.delete(key);
  }
  delByPattern(pattern) {
    const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
      }
    }
  }
};
var memoryCache = new MemoryCache();
var redisInstance = null;
var isRedisConnected = false;
var warningLogged = false;
try {
  const redisUrl = process.env.REDIS_URL;
  redisInstance = redisUrl ? new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2e3,
    enableOfflineQueue: false
  }) : new Redis({
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2e3,
    enableOfflineQueue: false
  });
  redisInstance.on("connect", () => {
    isRedisConnected = true;
    console.log("Redis cache connected successfully.");
  });
  redisInstance.on("error", (err) => {
    isRedisConnected = false;
    if (!warningLogged) {
      console.warn(
        "Notice: Redis unavailable, operating with in-memory cache fallback.",
        err.message
      );
      warningLogged = true;
    }
  });
  redisInstance.connect().catch((err) => {
    isRedisConnected = false;
    if (!warningLogged) {
      console.warn(
        "Notice: Redis connection failed, continuing with in-memory cache fallback.",
        err.message
      );
      warningLogged = true;
    }
  });
} catch {
  isRedisConnected = false;
}
var cache = {
  close() {
    redisInstance?.disconnect();
    isRedisConnected = false;
  },
  async get(key) {
    if (redisInstance && isRedisConnected) {
      try {
        const data = await redisInstance.get(key);
        if (data !== null) return data;
      } catch {
      }
    }
    return memoryCache.get(key);
  },
  async set(key, value, ttlSeconds = 60) {
    memoryCache.set(key, value, ttlSeconds);
    if (redisInstance && isRedisConnected) {
      try {
        await redisInstance.set(key, value, "EX", ttlSeconds);
      } catch {
      }
    }
  },
  async del(key) {
    const keys = Array.isArray(key) ? key : [key];
    for (const k of keys) {
      memoryCache.del(k);
    }
    if (redisInstance && isRedisConnected) {
      try {
        await redisInstance.del(...keys);
      } catch {
      }
    }
  },
  async delByPattern(pattern) {
    memoryCache.delByPattern(pattern);
    if (redisInstance && isRedisConnected) {
      try {
        const stream = redisInstance.scanStream({
          match: pattern,
          count: 100
        });
        stream.on("data", (keys) => {
          if (keys.length) {
            redisInstance?.del(...keys);
          }
        });
      } catch {
      }
    }
  },
  isConnected() {
    return isRedisConnected;
  }
};

// src/app/module/admin/admin.service.ts
var getAllUsers = async (filters) => {
  const { page, limit, role, status, searchTerm, sortBy, sortOrder } = filters;
  const andConditions = [{ isDeleted: false }];
  if (searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { email: { contains: searchTerm, mode: "insensitive" } },
        { phone: { contains: searchTerm, mode: "insensitive" } },
        { address: { contains: searchTerm, mode: "insensitive" } }
      ]
    });
  }
  if (role) {
    andConditions.push({ role });
  }
  if (status) {
    andConditions.push({ status });
  }
  const where = { AND: andConditions };
  const parsedPage = page;
  const parsedLimit = limit;
  const skip = (parsedPage - 1) * parsedLimit;
  const [total, result] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: parsedLimit,
      // sortBy is allow-listed; id keeps pages stable when values tie.
      orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
      omit: {
        password: true
      },
      include: {
        donorProfile: true
      }
    })
  ]);
  const totalPages = Math.ceil(total / parsedLimit);
  return {
    meta: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages
    },
    result
  };
};
var updateUserStatus = async (adminUserId, targetUserId, payload, ipAddress) => {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId, isDeleted: false }
  });
  if (!targetUser) {
    throw new AppError(
      httpStatus5.NOT_FOUND,
      "Target user not found or deleted"
    );
  }
  if (adminUserId === targetUserId && payload.status === UserStatus.BLOCKED) {
    throw new AppError(
      httpStatus5.BAD_REQUEST,
      "Admins are not permitted to block their own active account"
    );
  }
  const previousStatus = targetUser.status;
  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { status: payload.status },
    omit: {
      password: true
    },
    include: {
      donorProfile: true
    }
  });
  await prisma.auditLog.create({
    data: {
      userId: adminUserId,
      action: payload.status === UserStatus.BLOCKED ? "USER_BLOCKED" : "USER_ACTIVATED",
      resource: "User",
      resourceId: targetUserId,
      details: {
        previousStatus,
        newStatus: payload.status,
        reason: payload.reason || "Administrative moderation action",
        targetUserEmail: targetUser.email,
        targetUserRole: targetUser.role
      },
      ipAddress: ipAddress || null
    }
  });
  await Promise.all([
    cache.del("cache:admin:dashboard-stats"),
    cache.delByPattern("cache:matching-donors:*")
  ]);
  return updatedUser;
};
var getDashboardStats = async () => {
  const cacheKey = "cache:admin:dashboard-stats";
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch {
    }
  }
  const [
    totalUsers,
    totalDonors,
    availableDonors,
    totalBloodRequests,
    activeEmergencies,
    fulfilledRequests,
    totalDonationsCompleted,
    paymentsSummary,
    requestsByBloodGroupRaw,
    requestsByUrgencyRaw
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.user.count({ where: { role: Role.DONOR, isDeleted: false } }),
    prisma.donorProfile.count({
      where: {
        isAvailable: true,
        user: { isDeleted: false }
      }
    }),
    prisma.bloodRequest.count({ where: { isDeleted: false } }),
    prisma.bloodRequest.count({
      where: {
        isDeleted: false,
        status: { in: [RequestStatus.OPEN, RequestStatus.MATCHED] }
      }
    }),
    prisma.bloodRequest.count({
      where: {
        isDeleted: false,
        status: RequestStatus.FULFILLED
      }
    }),
    prisma.donationAssignment.count({
      where: { status: DonationStatus.COMPLETED }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      _count: { id: true },
      where: { status: PaymentStatus.COMPLETED }
    }),
    prisma.bloodRequest.groupBy({
      by: ["bloodGroup"],
      where: { isDeleted: false },
      _count: { id: true }
    }),
    prisma.bloodRequest.groupBy({
      by: ["urgency"],
      where: { isDeleted: false },
      _count: { id: true }
    })
  ]);
  const requestsByBloodGroup = {};
  for (const item of requestsByBloodGroupRaw) {
    requestsByBloodGroup[item.bloodGroup] = item._count.id;
  }
  const requestsByUrgency = {};
  for (const item of requestsByUrgencyRaw) {
    requestsByUrgency[item.urgency] = item._count.id;
  }
  const statsResult = {
    totalUsers,
    totalDonors,
    availableDonors,
    totalBloodRequests,
    activeEmergencies,
    fulfilledRequests,
    totalDonationsCompleted,
    totalPaymentsVolume: paymentsSummary._sum.amount || 0,
    totalSuccessfulPayments: paymentsSummary._count.id || 0,
    requestsByBloodGroup,
    requestsByUrgency
  };
  await cache.set(cacheKey, JSON.stringify(statsResult), 30);
  return statsResult;
};
var getAuditLogs = async (filters) => {
  const { page, limit, action, resource, sortBy, sortOrder } = filters;
  const andConditions = [];
  if (action) {
    andConditions.push({
      action: { contains: action, mode: "insensitive" }
    });
  }
  if (resource) {
    andConditions.push({
      resource: { contains: resource, mode: "insensitive" }
    });
  }
  const where = andConditions.length > 0 ? { AND: andConditions } : {};
  const parsedPage = page;
  const parsedLimit = limit;
  const skip = (parsedPage - 1) * parsedLimit;
  const [total, result] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })
  ]);
  const totalPages = Math.ceil(total / parsedLimit);
  return {
    meta: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages
    },
    result
  };
};
var AdminService = {
  getAllUsers,
  updateUserStatus,
  getDashboardStats,
  getAuditLogs
};

// src/app/module/admin/admin.controller.ts
var getAllUsers2 = catchAsync(async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const filters = adminUsersQuerySchema.parse(req.query);
  const result = await AdminService.getAllUsers(filters);
  sendResponse(res, {
    statusCode: httpStatus6.OK,
    success: true,
    message: "Users retrieved successfully",
    data: result
  });
});
var updateUserStatus2 = catchAsync(async (req, res) => {
  const adminUserId = req.user.userId;
  const targetUserId = req.params.id;
  const ipAddress = req.ip;
  const result = await AdminService.updateUserStatus(
    adminUserId,
    targetUserId,
    req.body,
    ipAddress
  );
  sendResponse(res, {
    statusCode: httpStatus6.OK,
    success: true,
    message: "User status updated successfully",
    data: result
  });
});
var getDashboardStats2 = catchAsync(async (_req, res) => {
  const result = await AdminService.getDashboardStats();
  sendResponse(res, {
    statusCode: httpStatus6.OK,
    success: true,
    message: "Dashboard statistics retrieved successfully",
    data: result
  });
});
var getAuditLogs2 = catchAsync(async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const filters = auditLogsQuerySchema.parse(req.query);
  const result = await AdminService.getAuditLogs(filters);
  sendResponse(res, {
    statusCode: httpStatus6.OK,
    success: true,
    message: "Audit logs retrieved successfully",
    data: result
  });
});
var AdminController = {
  getAllUsers: getAllUsers2,
  updateUserStatus: updateUserStatus2,
  getDashboardStats: getDashboardStats2,
  getAuditLogs: getAuditLogs2
};

// src/app/module/admin/admin.validation.ts
import { z as z2 } from "zod";
var updateUserStatusValidationSchema = z2.object({
  body: z2.object({
    status: z2.nativeEnum(UserStatus, {
      error: "Status must be either ACTIVE or BLOCKED"
    }),
    reason: z2.string().max(500, "Reason must not exceed 500 characters").optional()
  })
});
var AdminValidation = {
  updateUserStatusValidationSchema
};

// src/app/module/admin/admin.route.ts
var router = Router();
router.get("/users", auth(Role.ADMIN), AdminController.getAllUsers);
router.patch(
  "/users/:id/status",
  auth(Role.ADMIN),
  validateRequest(AdminValidation.updateUserStatusValidationSchema),
  AdminController.updateUserStatus
);
router.get(
  "/dashboard-stats",
  auth(Role.ADMIN),
  AdminController.getDashboardStats
);
router.get("/audit-logs", auth(Role.ADMIN), AdminController.getAuditLogs);
var AdminRoutes = router;

// src/app/module/auth/auth.route.ts
import { Router as Router2 } from "express";

// src/app/module/auth/auth.controller.ts
import httpStatus8 from "http-status";

// src/app/module/auth/auth.service.ts
import bcrypt from "bcryptjs";
import { OAuth2Client } from "google-auth-library";
import httpStatus7 from "http-status";
var googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
var registerUser = async (payload) => {
  const {
    name,
    password,
    role = Role.RECIPIENT,
    phone,
    address,
    bloodGroup,
    latitude,
    longitude
  } = payload;
  const email = payload.email.trim().toLowerCase();
  const isUserExists = await prisma.user.findUnique({
    where: { email }
  });
  if (isUserExists) {
    throw new AppError(
      httpStatus7.CONFLICT,
      "User with this email already exists"
    );
  }
  const hashedPassword = await bcrypt.hash(
    password,
    Number(config_default.bcrypt_salt_rounds) || 10
  );
  const createdUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      role,
      status: UserStatus.ACTIVE,
      phone,
      address,
      ...role === Role.DONOR && {
        donorProfile: {
          create: {
            bloodGroup,
            isAvailable: true,
            phone,
            address,
            latitude,
            longitude
          }
        }
      }
    },
    omit: { password: true },
    include: {
      donorProfile: true
    }
  });
  const jwtPayload = {
    userId: createdUser.id,
    name: createdUser.name,
    email: createdUser.email,
    role: createdUser.role
  };
  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config_default.jwt_access_secret,
    config_default.jwt_access_expires_in
  );
  const refreshToken3 = jwtUtils.createToken(
    jwtPayload,
    config_default.jwt_refresh_secret,
    config_default.jwt_refresh_expires_in
  );
  return {
    user: createdUser,
    accessToken,
    refreshToken: refreshToken3
  };
};
var loginUser = async (payload) => {
  const { password } = payload;
  const email = payload.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email },
    include: { donorProfile: true }
  });
  if (!user) {
    throw new AppError(httpStatus7.UNAUTHORIZED, "Invalid email or password");
  }
  if (user.isDeleted) {
    throw new AppError(httpStatus7.FORBIDDEN, "This account has been deleted");
  }
  if (user.status === UserStatus.BLOCKED) {
    throw new AppError(
      httpStatus7.FORBIDDEN,
      "Your account has been suspended by administration"
    );
  }
  if (!user.password) {
    throw new AppError(
      httpStatus7.BAD_REQUEST,
      "Password login not available for this account. Please use Google Login."
    );
  }
  const isPasswordMatched = await bcrypt.compare(password, user.password);
  if (!isPasswordMatched) {
    throw new AppError(httpStatus7.UNAUTHORIZED, "Invalid email or password");
  }
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config_default.jwt_access_secret,
    config_default.jwt_access_expires_in
  );
  const refreshToken3 = jwtUtils.createToken(
    jwtPayload,
    config_default.jwt_refresh_secret,
    config_default.jwt_refresh_expires_in
  );
  const { password: _, ...sanitizedUser } = user;
  return {
    user: sanitizedUser,
    accessToken,
    refreshToken: refreshToken3
  };
};
var googleLogin = async (payload) => {
  const { idToken, role = Role.RECIPIENT } = payload;
  let email = "";
  let name = "";
  let googleId = "";
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const tokenPayload = ticket.getPayload();
    if (!tokenPayload || !tokenPayload.email) {
      throw new Error("Invalid token payload");
    }
    email = tokenPayload.email.toLowerCase();
    name = tokenPayload.name || "Google User";
    googleId = tokenPayload.sub;
  } catch (err) {
    if (idToken.startsWith("demo_google_token_")) {
      email = idToken.replace("demo_google_token_", "").toLowerCase();
      name = email.split("@")[0] || "Demo Google User";
      googleId = `google_demo_${Date.now()}`;
    } else {
      throw new AppError(
        httpStatus7.UNAUTHORIZED,
        "Invalid or expired Google ID token"
      );
    }
  }
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { googleId }]
    },
    include: { donorProfile: true }
  });
  if (user) {
    if (user.status === UserStatus.BLOCKED) {
      throw new AppError(
        httpStatus7.FORBIDDEN,
        "Your account has been suspended"
      );
    }
    if (user.isDeleted) {
      throw new AppError(httpStatus7.FORBIDDEN, "Your account has been deleted");
    }
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
        include: { donorProfile: true }
      });
    }
  } else {
    user = await prisma.user.create({
      data: {
        name,
        email,
        googleId,
        role,
        status: UserStatus.ACTIVE,
        ...role === Role.DONOR && {
          donorProfile: {
            create: {
              isAvailable: true
            }
          }
        }
      },
      include: { donorProfile: true }
    });
  }
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config_default.jwt_access_secret,
    config_default.jwt_access_expires_in
  );
  const refreshToken3 = jwtUtils.createToken(
    jwtPayload,
    config_default.jwt_refresh_secret,
    config_default.jwt_refresh_expires_in
  );
  const { password: _, ...sanitizedUser } = user;
  return {
    user: sanitizedUser,
    accessToken,
    refreshToken: refreshToken3
  };
};
var refreshToken = async (token) => {
  const verifiedRefreshToken = jwtUtils.verifyToken(
    token,
    config_default.jwt_refresh_secret
  );
  if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
    throw new AppError(
      httpStatus7.UNAUTHORIZED,
      "Invalid or expired refresh token"
    );
  }
  const data = verifiedRefreshToken.data;
  const user = await prisma.user.findUnique({
    where: { id: data.userId }
  });
  if (!user || user.isDeleted || user.status !== UserStatus.ACTIVE) {
    throw new AppError(
      httpStatus7.UNAUTHORIZED,
      "User session is no longer active"
    );
  }
  const jwtPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config_default.jwt_access_secret,
    config_default.jwt_access_expires_in
  );
  const newRefreshToken = jwtUtils.createToken(
    jwtPayload,
    config_default.jwt_refresh_secret,
    config_default.jwt_refresh_expires_in
  );
  return {
    accessToken,
    refreshToken: newRefreshToken
  };
};
var AuthService = {
  registerUser,
  loginUser,
  googleLogin,
  refreshToken
};

// src/app/module/auth/auth.controller.ts
var registerUser2 = catchAsync(async (req, res) => {
  const result = await AuthService.registerUser(req.body);
  const { accessToken, refreshToken: refreshToken3, user } = result;
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1e3 * 60 * 60 * 24
    // 24 hours
  });
  res.cookie("refreshToken", refreshToken3, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1e3 * 60 * 60 * 24 * 7
    // 7 days
  });
  sendResponse(res, {
    statusCode: httpStatus8.CREATED,
    success: true,
    message: "User registered successfully",
    data: {
      accessToken,
      refreshToken: refreshToken3,
      user
    }
  });
});
var loginUser2 = catchAsync(async (req, res) => {
  const result = await AuthService.loginUser(req.body);
  const { accessToken, refreshToken: refreshToken3, user } = result;
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1e3 * 60 * 60 * 24
  });
  res.cookie("refreshToken", refreshToken3, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1e3 * 60 * 60 * 24 * 7
  });
  sendResponse(res, {
    statusCode: httpStatus8.OK,
    success: true,
    message: "User logged in successfully",
    data: {
      accessToken,
      refreshToken: refreshToken3,
      user
    }
  });
});
var googleLogin2 = catchAsync(async (req, res) => {
  const result = await AuthService.googleLogin(req.body);
  const { accessToken, refreshToken: refreshToken3, user } = result;
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1e3 * 60 * 60 * 24
  });
  res.cookie("refreshToken", refreshToken3, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1e3 * 60 * 60 * 24 * 7
  });
  sendResponse(res, {
    statusCode: httpStatus8.OK,
    success: true,
    message: "Google login successful",
    data: {
      accessToken,
      refreshToken: refreshToken3,
      user
    }
  });
});
var refreshToken2 = catchAsync(async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;
  if (!token) {
    throw new AppError(httpStatus8.UNAUTHORIZED, "Refresh token is missing");
  }
  const result = await AuthService.refreshToken(token);
  const { accessToken, refreshToken: newRefreshToken } = result;
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1e3 * 60 * 60 * 24
  });
  res.cookie("refreshToken", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 1e3 * 60 * 60 * 24 * 7
  });
  sendResponse(res, {
    statusCode: httpStatus8.OK,
    success: true,
    message: "New tokens generated successfully",
    data: {
      accessToken,
      refreshToken: newRefreshToken
    }
  });
});
var logout = catchAsync(async (_req, res) => {
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  sendResponse(res, {
    statusCode: httpStatus8.OK,
    success: true,
    message: "User logged out successfully",
    data: null
  });
});
var AuthController = {
  registerUser: registerUser2,
  loginUser: loginUser2,
  googleLogin: googleLogin2,
  refreshToken: refreshToken2,
  logout
};

// src/app/module/auth/auth.validation.ts
import { z as z3 } from "zod";
var registerValidationSchema = z3.object({
  body: z3.object({
    name: z3.string().min(2, "Name must be at least 2 characters"),
    email: z3.string().email("Invalid email format"),
    password: z3.string().min(6, "Password must be at least 6 characters"),
    role: z3.enum([Role.DONOR, Role.RECIPIENT], {
      error: "Role must be either DONOR or RECIPIENT"
    }).default(Role.RECIPIENT),
    phone: z3.string().optional(),
    address: z3.string().optional(),
    bloodGroup: z3.nativeEnum(BloodGroup).optional(),
    latitude: z3.number().optional(),
    longitude: z3.number().optional()
  })
});
var loginValidationSchema = z3.object({
  body: z3.object({
    email: z3.string().email("Invalid email format"),
    password: z3.string().min(1, "Password is required")
  })
});
var googleLoginValidationSchema = z3.object({
  body: z3.object({
    idToken: z3.string().min(1, "Google ID token is required"),
    role: z3.enum([Role.DONOR, Role.RECIPIENT]).optional().default(Role.RECIPIENT)
  })
});
var refreshTokenValidationSchema = z3.object({
  body: z3.object({
    refreshToken: z3.string().optional()
  }).optional(),
  cookies: z3.object({
    refreshToken: z3.string().optional()
  }).optional()
});
var AuthValidation = {
  registerValidationSchema,
  loginValidationSchema,
  googleLoginValidationSchema,
  refreshTokenValidationSchema
};

// src/app/module/auth/auth.route.ts
var router2 = Router2();
router2.post(
  "/register",
  authRateLimiter,
  validateRequest(AuthValidation.registerValidationSchema),
  AuthController.registerUser
);
router2.post(
  "/login",
  authRateLimiter,
  validateRequest(AuthValidation.loginValidationSchema),
  AuthController.loginUser
);
router2.post(
  "/google-login",
  validateRequest(AuthValidation.googleLoginValidationSchema),
  AuthController.googleLogin
);
router2.post(
  "/refresh-token",
  validateRequest(AuthValidation.refreshTokenValidationSchema),
  AuthController.refreshToken
);
router2.post("/logout", AuthController.logout);
var AuthRoutes = router2;

// src/app/module/bloodRequest/bloodRequest.route.ts
import { Router as Router3 } from "express";

// src/app/module/donation/donation.controller.ts
import httpStatus10 from "http-status";

// src/app/module/donation/donation.history.ts
import { z as z4 } from "zod";
var positiveInteger2 = (maximum, fallback) => z4.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z4.number().int().min(1).max(maximum)).default(fallback);
var donationHistoryQuerySchema = z4.object({
  status: z4.nativeEnum(DonationStatus).optional(),
  page: positiveInteger2(1e6, 1),
  limit: positiveInteger2(100, 10),
  sortBy: z4.enum(["createdAt", "updatedAt", "completedAt"]).default("createdAt"),
  sortOrder: z4.enum(["asc", "desc"]).default("desc")
}).strict();
var DAY_MS = 24 * 60 * 60 * 1e3;
var requestSelect = {
  id: true,
  patientName: true,
  bloodGroup: true,
  unitsNeeded: true,
  unitsFulfilled: true,
  hospitalName: true,
  hospitalAddress: true,
  urgency: true,
  status: true,
  createdAt: true
};
async function getDonationHistory(donorUserId, filters) {
  const { status, page, limit, sortBy, sortOrder } = filters;
  const ownerScope = { donorId: donorUserId };
  const where = {
    ...ownerScope,
    ...status ? { status } : {}
  };
  const snapshot = await prisma.$transaction(
    async (tx) => {
      const donorProfile = await tx.donorProfile.findUnique({
        where: { userId: donorUserId }
      });
      const total = await tx.donationAssignment.count({ where });
      const donations = await tx.donationAssignment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        // Nullable completedAt sorts last; id is the stable tie breaker.
        orderBy: [
          sortBy === "completedAt" ? { completedAt: { sort: sortOrder, nulls: "last" } } : { [sortBy]: sortOrder },
          { id: "asc" }
        ],
        include: { request: { select: requestSelect } }
      });
      const groups = await tx.donationAssignment.groupBy({
        by: ["status"],
        where: ownerScope,
        _count: { _all: true }
      });
      return { donorProfile, total, donations, groups };
    },
    { isolationLevel: "RepeatableRead" }
  );
  const counts = { ASSIGNED: 0, COMPLETED: 0, CANCELLED: 0 };
  for (const group of snapshot.groups) {
    counts[group.status] = group._count._all;
  }
  const totalAssigned = counts.ASSIGNED + counts.COMPLETED + counts.CANCELLED;
  const now = /* @__PURE__ */ new Date();
  const lastDonationDate = snapshot.donorProfile?.lastDonationDate ?? null;
  let nextEligibleDate = null;
  let isEligibleNow = true;
  let daysUntilEligible = 0;
  if (lastDonationDate) {
    const eligibleTime = lastDonationDate.getTime() + 90 * DAY_MS;
    nextEligibleDate = new Date(eligibleTime);
    if (now.getTime() < eligibleTime) {
      isEligibleNow = false;
      daysUntilEligible = Math.ceil((eligibleTime - now.getTime()) / DAY_MS);
    }
  }
  return {
    meta: {
      page,
      limit,
      total: snapshot.total,
      totalPages: Math.ceil(snapshot.total / limit)
    },
    // Summary counts every assignment the donor owns, independent of
    // the status filter and the current page.
    summary: {
      totalDonations: snapshot.donorProfile?.totalDonations || counts.COMPLETED,
      totalAssigned,
      totalCompleted: counts.COMPLETED,
      totalCancelled: counts.CANCELLED,
      totalActive: counts.ASSIGNED,
      isAvailable: snapshot.donorProfile?.isAvailable ?? false,
      lastDonationDate,
      nextEligibleDate,
      isEligibleNow,
      daysUntilEligible
    },
    donations: snapshot.donations
  };
}

// src/app/module/donation/donation.service.ts
import httpStatus9 from "http-status";

// src/app/utils/sendEmail.ts
import nodemailer from "nodemailer";
var sendEmail = async (payload) => {
  const { to, subject, text: text2, html } = payload;
  const isConfigured = config_default.email_user && config_default.google_app_password && !config_default.email_user.includes("your-email") && !config_default.google_app_password.includes("your-google-app-password");
  if (!isConfigured) {
    console.log(
      `[Email Notification Simulated - Configure real EMAIL_USER & GOOGLE_APP_PASSWORD in .env for live delivery]`
    );
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    return true;
  }
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: config_default.email_user,
        pass: config_default.google_app_password
      }
    });
    const info = await transporter.sendMail({
      from: `"Blood Donation & Emergency Platform" <${config_default.email_user}>`,
      to,
      subject,
      text: text2 || subject,
      html
    });
    console.log(
      `Email successfully delivered to ${to} (Message ID: ${info.messageId})`
    );
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    return false;
  }
};
var donorAssignedEmailHtml = (donorName, patientName, bloodGroup, hospitalName, contactNumber) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
	<div style="background-color: #16a34a; color: white; padding: 20px; text-align: center;">
		<h1 style="margin: 0; font-size: 24px;">\u2705 Donor Match Confirmed!</h1>
		<p style="margin: 5px 0 0 0; opacity: 0.9;">A donor has accepted your blood request</p>
	</div>
	<div style="padding: 24px; color: #1e293b;">
		<p>Good news! Donor <strong>${donorName}</strong> has agreed to donate blood for <strong>${patientName}</strong> (${bloodGroup}).</p>
		<div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; margin: 16px 0;">
			<p style="margin: 0 0 8px 0;"><strong>Location:</strong> ${hospitalName}</p>
			<p style="margin: 0;"><strong>Contact Hotline:</strong> <a href="tel:${contactNumber}" style="color: #2563eb;">${contactNumber}</a></p>
		</div>
		<p>Please coordinate with the donor promptly. Thank you for using our emergency platform.</p>
	</div>
	<div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
		Blood Donation & Emergency Assistance Platform \u2022 Automated Notification
	</div>
</div>
`;
var paymentReceiptEmailHtml = (payerName, amount, currency, transactionRef, paymentID) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
	<div style="background-color: #e11d48; color: white; padding: 20px; text-align: center;">
		<h1 style="margin: 0; font-size: 24px;">\u{1F9FE} Payment Receipt</h1>
		<p style="margin: 5px 0 0 0; opacity: 0.9;">Emergency Logistics & Verification Fee</p>
	</div>
	<div style="padding: 24px; color: #1e293b;">
		<p>Dear <strong>${payerName}</strong>,</p>
		<p>Your payment has been verified and completed successfully.</p>
		<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Amount Paid:</td>
				<td style="padding: 8px 0; font-size: 18px; color: #e11d48; font-weight: bold;">${amount} ${currency}</td>
			</tr>
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Transaction reference:</td>
				<td style="padding: 8px 0; font-family: monospace; font-size: 14px;">${transactionRef}</td>
			</tr>
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Payment ID:</td>
				<td style="padding: 8px 0; font-family: monospace; font-size: 14px;">${paymentID}</td>
			</tr>
			<tr>
				<td style="padding: 8px 0; font-weight: bold;">Status:</td>
				<td style="padding: 8px 0; color: #16a34a; font-weight: bold;">COMPLETED</td>
			</tr>
		</table>
	</div>
	<div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
		Blood Donation & Emergency Assistance Platform \u2022 Payment Confirmation
	</div>
</div>
`;

// src/app/module/donation/donation.service.ts
var BLOOD_COMPATIBILITY = {
  [BloodGroup.A_POSITIVE]: [
    BloodGroup.A_POSITIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.O_NEGATIVE
  ],
  [BloodGroup.A_NEGATIVE]: [BloodGroup.A_NEGATIVE, BloodGroup.O_NEGATIVE],
  [BloodGroup.B_POSITIVE]: [
    BloodGroup.B_POSITIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.O_NEGATIVE
  ],
  [BloodGroup.B_NEGATIVE]: [BloodGroup.B_NEGATIVE, BloodGroup.O_NEGATIVE],
  [BloodGroup.AB_POSITIVE]: [
    BloodGroup.A_POSITIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.B_POSITIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.AB_POSITIVE,
    BloodGroup.AB_NEGATIVE,
    BloodGroup.O_POSITIVE,
    BloodGroup.O_NEGATIVE
  ],
  [BloodGroup.AB_NEGATIVE]: [
    BloodGroup.AB_NEGATIVE,
    BloodGroup.A_NEGATIVE,
    BloodGroup.B_NEGATIVE,
    BloodGroup.O_NEGATIVE
  ],
  [BloodGroup.O_POSITIVE]: [BloodGroup.O_POSITIVE, BloodGroup.O_NEGATIVE],
  [BloodGroup.O_NEGATIVE]: [BloodGroup.O_NEGATIVE]
};
var calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
};
var getMatchingDonors = async (requestId, query, userId, role) => {
  if (role !== Role.RECIPIENT && role !== Role.ADMIN) {
    throw new AppError(
      httpStatus9.FORBIDDEN,
      "Matching access is not permitted"
    );
  }
  const bloodRequest = await prisma.bloodRequest.findUnique({
    where: { id: requestId, isDeleted: false }
  });
  if (!bloodRequest) {
    throw new AppError(httpStatus9.NOT_FOUND, "Blood request not found");
  }
  if (role !== Role.ADMIN && bloodRequest.requesterId !== userId) {
    throw new AppError(httpStatus9.NOT_FOUND, "Blood request not found");
  }
  const cacheKey = `cache:matching-donors:${requestId}:${JSON.stringify(query)}`;
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch {
    }
  }
  const reqBloodGroup = bloodRequest.bloodGroup;
  const compatibleGroups = BLOOD_COMPATIBILITY[reqBloodGroup];
  const now = /* @__PURE__ */ new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1e3);
  const candidateProfiles = await prisma.donorProfile.findMany({
    where: {
      isAvailable: true,
      bloodGroup: { in: compatibleGroups },
      OR: [
        { lastDonationDate: null },
        { lastDonationDate: { lte: ninetyDaysAgo } }
      ],
      user: {
        status: "ACTIVE",
        isDeleted: false,
        id: { not: bloodRequest.requesterId }
      }
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      }
    }
  });
  const mappedDonors = candidateProfiles.map(
    (profile) => {
      let distanceKm = null;
      if (profile.latitude !== null && profile.latitude !== void 0 && profile.longitude !== null && profile.longitude !== void 0 && bloodRequest.latitude !== null && bloodRequest.longitude !== null) {
        distanceKm = calculateDistanceKm(
          bloodRequest.latitude,
          bloodRequest.longitude,
          profile.latitude,
          profile.longitude
        );
      }
      const daysSinceLastDonation = profile.lastDonationDate ? Math.floor(
        (now.getTime() - profile.lastDonationDate.getTime()) / (24 * 60 * 60 * 1e3)
      ) : null;
      return {
        donorProfileId: profile.id,
        donorUserId: profile.userId,
        name: profile.user.name,
        email: profile.user.email,
        phone: profile.phone || profile.user.phone,
        bloodGroup: profile.bloodGroup,
        address: profile.address,
        latitude: profile.latitude,
        longitude: profile.longitude,
        distanceKm,
        isAvailable: profile.isAvailable,
        lastDonationDate: profile.lastDonationDate,
        totalDonations: profile.totalDonations,
        daysSinceLastDonation
      };
    }
  );
  let filteredDonors = mappedDonors;
  if (query.maxDistanceKm !== void 0 && query.maxDistanceKm > 0) {
    filteredDonors = filteredDonors.filter(
      (donor) => donor.distanceKm !== null && donor.distanceKm <= query.maxDistanceKm
    );
  }
  filteredDonors.sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) {
      return a.distanceKm - b.distanceKm;
    }
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    return 0;
  });
  const responseData = {
    bloodRequest: {
      id: bloodRequest.id,
      patientName: bloodRequest.patientName,
      bloodGroup: bloodRequest.bloodGroup,
      unitsNeeded: bloodRequest.unitsNeeded,
      unitsFulfilled: bloodRequest.unitsFulfilled,
      hospitalName: bloodRequest.hospitalName,
      hospitalAddress: bloodRequest.hospitalAddress,
      urgency: bloodRequest.urgency,
      status: bloodRequest.status
    },
    compatibleBloodGroups: compatibleGroups,
    totalMatchingDonors: filteredDonors.length,
    donors: filteredDonors
  };
  await cache.set(cacheKey, JSON.stringify(responseData), 60);
  return responseData;
};
var acceptBloodRequest = async (requestId, donorUserId, payload) => {
  const donorProfile = await prisma.donorProfile.findUnique({
    where: { userId: donorUserId }
  });
  if (!donorProfile) {
    throw new AppError(
      httpStatus9.FORBIDDEN,
      "You must set up your donor profile before accepting blood requests."
    );
  }
  if (!donorProfile.isAvailable) {
    throw new AppError(
      httpStatus9.BAD_REQUEST,
      "You are currently marked as unavailable for donations."
    );
  }
  if (donorProfile.lastDonationDate) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1e3);
    if (donorProfile.lastDonationDate > ninetyDaysAgo) {
      const daysSince = Math.floor(
        (Date.now() - donorProfile.lastDonationDate.getTime()) / (24 * 60 * 60 * 1e3)
      );
      const daysRemaining = 90 - daysSince;
      throw new AppError(
        httpStatus9.BAD_REQUEST,
        `Medical cooldown in effect: You last donated blood ${daysSince} days ago. You must wait ${daysRemaining} more days before donating again.`
      );
    }
  }
  const assignment = await prisma.$transaction(
    async (tx) => {
      const bloodRequest = await tx.bloodRequest.findUnique({
        where: { id: requestId, isDeleted: false }
      });
      if (!bloodRequest) {
        throw new AppError(httpStatus9.NOT_FOUND, "Blood request not found");
      }
      if (bloodRequest.requesterId === donorUserId) {
        throw new AppError(
          httpStatus9.BAD_REQUEST,
          "You cannot accept your own blood request."
        );
      }
      if (donorProfile.bloodGroup) {
        const reqBloodGroup = bloodRequest.bloodGroup;
        const compatible = BLOOD_COMPATIBILITY[reqBloodGroup];
        const donorBloodGroup = donorProfile.bloodGroup;
        if (!compatible.includes(donorBloodGroup)) {
          throw new AppError(
            httpStatus9.BAD_REQUEST,
            `Your blood group (${donorProfile.bloodGroup}) is not biologically compatible with this request (${bloodRequest.bloodGroup}).`
          );
        }
      }
      if (bloodRequest.status === RequestStatus.FULFILLED || bloodRequest.status === RequestStatus.CANCELLED || bloodRequest.unitsFulfilled >= bloodRequest.unitsNeeded) {
        throw new AppError(
          httpStatus9.CONFLICT,
          "This blood request has already been fulfilled or closed by other donors."
        );
      }
      const existingAssignment = await tx.donationAssignment.findUnique({
        where: {
          requestId_donorId: {
            requestId,
            donorId: donorUserId
          }
        }
      });
      if (existingAssignment) {
        if (existingAssignment.status !== DonationStatus.CANCELLED) {
          throw new AppError(
            httpStatus9.CONFLICT,
            "You have already accepted this blood request."
          );
        }
        const nextUnits2 = bloodRequest.unitsFulfilled + 1;
        const nextStatus2 = nextUnits2 >= bloodRequest.unitsNeeded ? RequestStatus.FULFILLED : RequestStatus.MATCHED;
        await tx.bloodRequest.update({
          where: { id: requestId },
          data: {
            unitsFulfilled: nextUnits2,
            status: nextStatus2
          }
        });
        return tx.donationAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            status: DonationStatus.ASSIGNED,
            notes: payload.notes || existingAssignment.notes,
            completedAt: null
          },
          include: {
            request: true,
            donor: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        });
      }
      const nextUnits = bloodRequest.unitsFulfilled + 1;
      const nextStatus = nextUnits >= bloodRequest.unitsNeeded ? RequestStatus.FULFILLED : RequestStatus.MATCHED;
      await tx.bloodRequest.update({
        where: { id: requestId },
        data: {
          unitsFulfilled: nextUnits,
          status: nextStatus
        }
      });
      return tx.donationAssignment.create({
        data: {
          requestId,
          donorId: donorUserId,
          status: DonationStatus.ASSIGNED,
          notes: payload.notes
        },
        include: {
          request: true,
          donor: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          }
        }
      });
    }
  );
  await Promise.all([
    cache.delByPattern("cache:matching-donors:*"),
    cache.delByPattern("cache:blood-requests:*"),
    cache.del("cache:admin:dashboard-stats")
  ]);
  const requester = await prisma.user.findUnique({
    where: { id: assignment.request.requesterId }
  });
  if (requester?.email) {
    sendEmail({
      to: requester.email,
      subject: `Donor Found: ${assignment.donor.name} accepted your blood request`,
      html: donorAssignedEmailHtml(
        assignment.donor.name,
        assignment.request.patientName,
        assignment.request.bloodGroup,
        assignment.request.hospitalName,
        assignment.donor.phone || assignment.request.contactNumber
      )
    }).catch((err) => console.error("Email notification dispatch error:", err));
  }
  return assignment;
};
var updateDonationStatus = async (assignmentId, userId, userRole, payload) => {
  const assignment = await prisma.donationAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      request: true
    }
  });
  if (!assignment) {
    throw new AppError(httpStatus9.NOT_FOUND, "Donation assignment not found");
  }
  const isDonor = assignment.donorId === userId;
  const isRequester = assignment.request.requesterId === userId;
  const isAdmin = userRole === Role.ADMIN;
  if (!isDonor && !isRequester && !isAdmin) {
    throw new AppError(
      httpStatus9.FORBIDDEN,
      "You do not have permission to update this donation assignment."
    );
  }
  if (assignment.status === DonationStatus.COMPLETED) {
    throw new AppError(
      httpStatus9.BAD_REQUEST,
      "Donation assignment has already been completed and cannot be modified."
    );
  }
  if (assignment.status === DonationStatus.CANCELLED) {
    throw new AppError(
      httpStatus9.BAD_REQUEST,
      "Donation assignment has already been cancelled and cannot be modified."
    );
  }
  const updated = await prisma.$transaction(
    async (tx) => {
      if (payload.status === DonationStatus.COMPLETED) {
        const completedAssignment = await tx.donationAssignment.update({
          where: { id: assignmentId },
          data: {
            status: DonationStatus.COMPLETED,
            completedAt: /* @__PURE__ */ new Date(),
            notes: payload.notes || assignment.notes
          },
          include: {
            request: true,
            donor: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        });
        await tx.donorProfile.update({
          where: { userId: assignment.donorId },
          data: {
            lastDonationDate: /* @__PURE__ */ new Date(),
            totalDonations: { increment: 1 },
            isAvailable: false
            // 90-day cooldown commences
          }
        });
        return completedAssignment;
      }
      if (payload.status === DonationStatus.CANCELLED) {
        const cancelledAssignment = await tx.donationAssignment.update({
          where: { id: assignmentId },
          data: {
            status: DonationStatus.CANCELLED,
            notes: payload.notes || assignment.notes
          },
          include: {
            request: true,
            donor: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        });
        const currentUnits = assignment.request.unitsFulfilled;
        const nextUnits = Math.max(0, currentUnits - 1);
        const nextStatus = nextUnits === 0 ? RequestStatus.OPEN : RequestStatus.MATCHED;
        await tx.bloodRequest.update({
          where: { id: assignment.requestId },
          data: {
            unitsFulfilled: nextUnits,
            status: nextStatus
          }
        });
        return cancelledAssignment;
      }
      throw new AppError(
        httpStatus9.BAD_REQUEST,
        "Invalid target donation status."
      );
    }
  );
  await Promise.all([
    cache.delByPattern("cache:matching-donors:*"),
    cache.delByPattern("cache:blood-requests:*"),
    cache.del("cache:admin:dashboard-stats")
  ]);
  return updated;
};
var DonationService = {
  getMatchingDonors,
  acceptBloodRequest,
  updateDonationStatus
};

// src/app/module/bloodRequest/bloodRequest.public.ts
import { z as z5 } from "zod";
var positiveInteger3 = (maximum, fallback) => z5.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z5.number().int().min(1).max(maximum)).default(fallback);
var publicRequestQuerySchema = z5.object({
  searchTerm: z5.string().trim().max(200).optional(),
  bloodGroup: z5.nativeEnum(BloodGroup).optional(),
  urgency: z5.nativeEnum(UrgencyLevel).optional(),
  status: z5.nativeEnum(RequestStatus).optional(),
  page: positiveInteger3(1e6, 1),
  limit: positiveInteger3(100, 10),
  sortBy: z5.enum(["createdAt", "updatedAt", "urgency", "unitsNeeded"]).default("createdAt"),
  sortOrder: z5.enum(["asc", "desc"]).default("desc")
}).strict();
var publicRequestIdSchema = z5.string().uuid();
var publicRequestSelect = {
  id: true,
  patientName: true,
  bloodGroup: true,
  unitsNeeded: true,
  unitsFulfilled: true,
  hospitalName: true,
  hospitalAddress: true,
  urgency: true,
  status: true,
  createdAt: true,
  updatedAt: true
};

// src/app/module/donation/donation.controller.ts
var getMatchingDonors2 = catchAsync(async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const requestId = publicRequestIdSchema.parse(req.params.id);
  const maxDistanceKm = req.query.maxDistanceKm ? Number(req.query.maxDistanceKm) : void 0;
  const result = await DonationService.getMatchingDonors(
    requestId,
    { maxDistanceKm },
    req.user.userId,
    req.user.role
  );
  sendResponse(res, {
    statusCode: httpStatus10.OK,
    success: true,
    message: "Compatible matching donors retrieved successfully",
    data: result
  });
});
var acceptBloodRequest2 = catchAsync(async (req, res) => {
  const requestId = req.params.id;
  const donorUserId = req.user.userId;
  const result = await DonationService.acceptBloodRequest(
    requestId,
    donorUserId,
    req.body
  );
  sendResponse(res, {
    statusCode: httpStatus10.CREATED,
    success: true,
    message: "Blood donation request accepted successfully. Donor assignment created.",
    data: result
  });
});
var updateDonationStatus2 = catchAsync(async (req, res) => {
  const assignmentId = req.params.id;
  const userId = req.user.userId;
  const userRole = req.user.role;
  const result = await DonationService.updateDonationStatus(
    assignmentId,
    userId,
    userRole,
    req.body
  );
  sendResponse(res, {
    statusCode: httpStatus10.OK,
    success: true,
    message: "Donation assignment status updated successfully",
    data: result
  });
});
var getMyDonationHistory = catchAsync(async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const donorUserId = req.user.userId;
  const filters = donationHistoryQuerySchema.parse(req.query);
  const result = await getDonationHistory(donorUserId, filters);
  sendResponse(res, {
    statusCode: httpStatus10.OK,
    success: true,
    message: "Donor donation history and statistics retrieved successfully",
    data: result
  });
});
var DonationController = {
  getMatchingDonors: getMatchingDonors2,
  acceptBloodRequest: acceptBloodRequest2,
  updateDonationStatus: updateDonationStatus2,
  getMyDonationHistory
};

// src/app/module/donation/donation.validation.ts
import { z as z6 } from "zod";
var matchingDonorsQuerySchema = z6.object({
  query: z6.object({
    maxDistanceKm: z6.string().optional().transform((val) => val ? Number(val) : void 0).refine((val) => val === void 0 || !Number.isNaN(val) && val > 0, {
      message: "maxDistanceKm must be a positive number"
    })
  }).optional()
});
var acceptBloodRequestSchema = z6.object({
  body: z6.object({
    notes: z6.string().max(500, "Notes cannot exceed 500 characters").optional()
  })
});
var updateDonationStatusSchema = z6.object({
  body: z6.object({
    status: z6.enum([DonationStatus.COMPLETED, DonationStatus.CANCELLED]),
    notes: z6.string().max(500, "Notes cannot exceed 500 characters").optional()
  })
});
var DonationValidation = {
  matchingDonorsQuerySchema,
  acceptBloodRequestSchema,
  updateDonationStatusSchema
};

// src/app/module/bloodRequest/bloodRequest.controller.ts
import httpStatus13 from "http-status";

// src/app/module/bloodRequest/bloodRequest.service.ts
import httpStatus11 from "http-status";
var createBloodRequest = async (requesterId, payload) => {
  const result = await prisma.bloodRequest.create({
    data: {
      requesterId,
      patientName: payload.patientName,
      bloodGroup: payload.bloodGroup,
      unitsNeeded: payload.unitsNeeded ?? 1,
      unitsFulfilled: 0,
      hospitalName: payload.hospitalName,
      hospitalAddress: payload.hospitalAddress,
      latitude: payload.latitude,
      longitude: payload.longitude,
      contactNumber: payload.contactNumber,
      urgency: payload.urgency ?? UrgencyLevel.NORMAL,
      notes: payload.notes
    },
    include: {
      requester: {
        omit: {
          password: true
        }
      }
    }
  });
  await prisma.auditLog.create({
    data: {
      userId: requesterId,
      action: "CREATE_BLOOD_REQUEST",
      resource: "BloodRequest",
      resourceId: result.id,
      details: {
        bloodGroup: result.bloodGroup,
        urgency: result.urgency,
        hospitalName: result.hospitalName
      }
    }
  });
  await Promise.all([
    cache.delByPattern("cache:blood-requests:*"),
    cache.delByPattern("cache:matching-donors:*"),
    cache.del("cache:admin:dashboard-stats")
  ]);
  return result;
};
var getAllBloodRequests = async (filters) => {
  const cacheKey = `cache:blood-requests:public-v2:${JSON.stringify(filters)}`;
  const cachedData = await cache.get(cacheKey);
  if (cachedData) {
    try {
      return JSON.parse(cachedData);
    } catch {
    }
  }
  const {
    searchTerm,
    bloodGroup,
    urgency,
    status,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc"
  } = filters;
  const andConditions = [{ isDeleted: false }];
  if (searchTerm) {
    andConditions.push({
      OR: [
        { patientName: { contains: searchTerm, mode: "insensitive" } },
        { hospitalName: { contains: searchTerm, mode: "insensitive" } },
        { hospitalAddress: { contains: searchTerm, mode: "insensitive" } }
      ]
    });
  }
  if (bloodGroup) {
    andConditions.push({ bloodGroup });
  }
  if (urgency) {
    andConditions.push({ urgency });
  }
  if (status) {
    andConditions.push({ status });
  }
  const where = { AND: andConditions };
  const parsedPage = Number(page) > 0 ? Number(page) : 1;
  const parsedLimit = Number(limit) > 0 ? Number(limit) : 10;
  const skip = (parsedPage - 1) * parsedLimit;
  const [total, result] = await Promise.all([
    prisma.bloodRequest.count({ where }),
    prisma.bloodRequest.findMany({
      where,
      skip,
      take: parsedLimit,
      orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
      select: publicRequestSelect
    })
  ]);
  const totalPages = Math.ceil(total / parsedLimit);
  const responseData = {
    meta: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages
    },
    result
  };
  await cache.set(cacheKey, JSON.stringify(responseData), 30);
  return responseData;
};
var getBloodRequestById = async (id) => {
  const request = await prisma.bloodRequest.findUnique({
    where: { id, isDeleted: false },
    select: publicRequestSelect
  });
  if (!request) {
    throw new AppError(httpStatus11.NOT_FOUND, "Blood request not found");
  }
  return request;
};
var updateBloodRequest = async (id, userId, userRole, payload) => {
  const existingRequest = await prisma.bloodRequest.findUnique({
    where: { id, isDeleted: false }
  });
  if (!existingRequest) {
    throw new AppError(httpStatus11.NOT_FOUND, "Blood request not found");
  }
  if (userRole !== Role.ADMIN && existingRequest.requesterId !== userId) {
    throw new AppError(
      httpStatus11.FORBIDDEN,
      "You do not have permission to update this blood request"
    );
  }
  const updated = await prisma.bloodRequest.update({
    where: { id },
    data: payload,
    include: {
      requester: {
        omit: {
          password: true
        }
      }
    }
  });
  await prisma.auditLog.create({
    data: {
      userId,
      action: "UPDATE_BLOOD_REQUEST",
      resource: "BloodRequest",
      resourceId: id,
      details: payload
    }
  });
  await Promise.all([
    cache.delByPattern("cache:blood-requests:*"),
    cache.delByPattern("cache:matching-donors:*"),
    cache.del("cache:admin:dashboard-stats")
  ]);
  return updated;
};
var deleteBloodRequest = async (id, userId, userRole) => {
  const existingRequest = await prisma.bloodRequest.findUnique({
    where: { id, isDeleted: false }
  });
  if (!existingRequest) {
    throw new AppError(httpStatus11.NOT_FOUND, "Blood request not found");
  }
  if (userRole !== Role.ADMIN && existingRequest.requesterId !== userId) {
    throw new AppError(
      httpStatus11.FORBIDDEN,
      "You do not have permission to delete this blood request"
    );
  }
  const softDeleted = await prisma.bloodRequest.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: /* @__PURE__ */ new Date()
    }
  });
  await prisma.auditLog.create({
    data: {
      userId,
      action: "SOFT_DELETE_BLOOD_REQUEST",
      resource: "BloodRequest",
      resourceId: id
    }
  });
  await Promise.all([
    cache.delByPattern("cache:blood-requests:*"),
    cache.delByPattern("cache:matching-donors:*"),
    cache.del("cache:admin:dashboard-stats")
  ]);
  return softDeleted;
};
var BloodRequestService = {
  createBloodRequest,
  getAllBloodRequests,
  getBloodRequestById,
  updateBloodRequest,
  deleteBloodRequest
};

// src/app/module/bloodRequest/bloodRequest.workspace.ts
import httpStatus12 from "http-status";
import { z as z7 } from "zod";
var workspaceRequestQuerySchema = z7.object({}).strict();
var workspaceRequestSelect = {
  ...publicRequestSelect,
  requesterId: true,
  latitude: true,
  longitude: true,
  contactNumber: true,
  notes: true,
  assignments: {
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      donorId: true,
      status: true,
      notes: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      donor: {
        select: {
          id: true,
          name: true,
          phone: true,
          donorProfile: { select: { bloodGroup: true, phone: true } }
        }
      }
    }
  }
};
async function getWorkspaceBloodRequest(id, userId, role) {
  if (role !== Role.RECIPIENT && role !== Role.ADMIN) {
    throw new AppError(
      httpStatus12.FORBIDDEN,
      "Workspace access is not permitted"
    );
  }
  const result = await prisma.bloodRequest.findFirst({
    where: {
      id,
      isDeleted: false,
      ...role === Role.ADMIN ? {} : { requesterId: userId }
    },
    select: workspaceRequestSelect
  });
  if (!result)
    throw new AppError(httpStatus12.NOT_FOUND, "Blood request not found");
  return result;
}

// src/app/module/bloodRequest/bloodRequest.owned.ts
var ownedRequestQuerySchema = publicRequestQuerySchema;
async function getOwnedBloodRequests(requesterId, filters) {
  const {
    page,
    limit,
    searchTerm,
    bloodGroup,
    urgency,
    status,
    sortBy,
    sortOrder
  } = filters;
  const ownerScope = { requesterId, isDeleted: false };
  const where = {
    ...ownerScope,
    ...bloodGroup ? { bloodGroup } : {},
    ...urgency ? { urgency } : {},
    ...status ? { status } : {},
    ...searchTerm ? {
      OR: [
        { patientName: { contains: searchTerm, mode: "insensitive" } },
        { hospitalName: { contains: searchTerm, mode: "insensitive" } },
        { hospitalAddress: { contains: searchTerm, mode: "insensitive" } }
      ]
    } : {}
  };
  return prisma.$transaction(
    async (tx) => {
      const total = await tx.bloodRequest.count({ where });
      const result = await tx.bloodRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
        select: publicRequestSelect
      });
      const groups = await tx.bloodRequest.groupBy({
        by: ["status"],
        where: ownerScope,
        _count: { _all: true }
      });
      const summary = {
        total: 0,
        open: 0,
        matched: 0,
        fulfilled: 0,
        cancelled: 0
      };
      for (const group of groups) {
        const count = group._count._all;
        summary.total += count;
        switch (group.status) {
          case "OPEN":
            summary.open = count;
            break;
          case "MATCHED":
            summary.matched = count;
            break;
          case "FULFILLED":
            summary.fulfilled = count;
            break;
          case "CANCELLED":
            summary.cancelled = count;
            break;
        }
      }
      return {
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        result,
        summary
      };
    },
    { isolationLevel: "RepeatableRead" }
  );
}

// src/app/module/bloodRequest/bloodRequest.controller.ts
var getWorkspaceRequest = catchAsync(async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const id = publicRequestIdSchema.parse(req.params.id);
  workspaceRequestQuerySchema.parse(req.query);
  const result = await getWorkspaceBloodRequest(
    id,
    req.user.userId,
    req.user.role
  );
  sendResponse(res, {
    statusCode: httpStatus13.OK,
    success: true,
    message: "Request workspace retrieved successfully",
    data: result
  });
});
var getMyBloodRequests = catchAsync(async (req, res) => {
  const filters = ownedRequestQuerySchema.parse(req.query);
  const result = await getOwnedBloodRequests(req.user.userId, filters);
  res.setHeader("Cache-Control", "private, no-store");
  sendResponse(res, {
    statusCode: httpStatus13.OK,
    success: true,
    message: "Your blood requests retrieved successfully",
    data: result
  });
});
var createBloodRequest2 = catchAsync(async (req, res) => {
  const requesterId = req.user.userId;
  const result = await BloodRequestService.createBloodRequest(
    requesterId,
    req.body
  );
  sendResponse(res, {
    statusCode: httpStatus13.CREATED,
    success: true,
    message: "Emergency blood request created successfully",
    data: result
  });
});
var getAllBloodRequests2 = catchAsync(async (req, res) => {
  const filters = publicRequestQuerySchema.parse(req.query);
  const result = await BloodRequestService.getAllBloodRequests(filters);
  sendResponse(res, {
    statusCode: httpStatus13.OK,
    success: true,
    message: "Blood requests retrieved successfully",
    data: result
  });
});
var getBloodRequestById2 = catchAsync(async (req, res) => {
  const id = publicRequestIdSchema.parse(req.params.id);
  const result = await BloodRequestService.getBloodRequestById(id);
  sendResponse(res, {
    statusCode: httpStatus13.OK,
    success: true,
    message: "Blood request details retrieved successfully",
    data: result
  });
});
var updateBloodRequest2 = catchAsync(async (req, res) => {
  const id = req.params.id;
  const userId = req.user.userId;
  const userRole = req.user.role;
  const result = await BloodRequestService.updateBloodRequest(
    id,
    userId,
    userRole,
    req.body
  );
  sendResponse(res, {
    statusCode: httpStatus13.OK,
    success: true,
    message: "Blood request updated successfully",
    data: result
  });
});
var deleteBloodRequest2 = catchAsync(async (req, res) => {
  const id = req.params.id;
  const userId = req.user.userId;
  const userRole = req.user.role;
  await BloodRequestService.deleteBloodRequest(id, userId, userRole);
  sendResponse(res, {
    statusCode: httpStatus13.OK,
    success: true,
    message: "Blood request deleted successfully",
    data: null
  });
});
var BloodRequestController = {
  getWorkspaceRequest,
  getMyBloodRequests,
  createBloodRequest: createBloodRequest2,
  getAllBloodRequests: getAllBloodRequests2,
  getBloodRequestById: getBloodRequestById2,
  updateBloodRequest: updateBloodRequest2,
  deleteBloodRequest: deleteBloodRequest2
};

// src/app/module/bloodRequest/bloodRequest.validation.ts
import { z as z8 } from "zod";
var createBloodRequestSchema = z8.object({
  body: z8.object({
    patientName: z8.string().min(2, "Patient name must be at least 2 characters"),
    bloodGroup: z8.nativeEnum(BloodGroup, {
      error: "Valid blood group is required"
    }),
    unitsNeeded: z8.number().int().min(1, "At least 1 unit is required").default(1),
    hospitalName: z8.string().min(2, "Hospital name is required"),
    hospitalAddress: z8.string().min(2, "Hospital address is required"),
    latitude: z8.number().min(-90, "Latitude must be >= -90").max(90, "Latitude must be <= 90"),
    longitude: z8.number().min(-180, "Longitude must be >= -180").max(180, "Longitude must be <= 180"),
    contactNumber: z8.string().min(6, "Valid contact number is required"),
    urgency: z8.nativeEnum(UrgencyLevel).optional().default(UrgencyLevel.NORMAL),
    notes: z8.string().optional()
  })
});
var updateBloodRequestSchema = z8.object({
  body: z8.object({
    patientName: z8.string().min(2).optional(),
    bloodGroup: z8.nativeEnum(BloodGroup).optional(),
    unitsNeeded: z8.number().int().min(1).optional(),
    hospitalName: z8.string().min(2).optional(),
    hospitalAddress: z8.string().min(2).optional(),
    latitude: z8.number().min(-90).max(90).optional(),
    longitude: z8.number().min(-180).max(180).optional(),
    contactNumber: z8.string().min(6).optional(),
    urgency: z8.nativeEnum(UrgencyLevel).optional(),
    status: z8.nativeEnum(RequestStatus).optional(),
    notes: z8.string().optional()
  })
});
var BloodRequestValidation = {
  createBloodRequestSchema,
  updateBloodRequestSchema
};

// src/app/module/bloodRequest/bloodRequest.route.ts
var router3 = Router3();
router3.post(
  "/",
  auth(Role.RECIPIENT, Role.ADMIN),
  validateRequest(BloodRequestValidation.createBloodRequestSchema),
  BloodRequestController.createBloodRequest
);
router3.get("/", BloodRequestController.getAllBloodRequests);
router3.get(
  "/mine",
  auth(Role.RECIPIENT, Role.ADMIN),
  BloodRequestController.getMyBloodRequests
);
router3.get(
  "/:id/matching-donors",
  auth(Role.RECIPIENT, Role.ADMIN),
  validateRequest(DonationValidation.matchingDonorsQuerySchema),
  DonationController.getMatchingDonors
);
router3.post(
  "/:id/accept",
  auth(Role.DONOR),
  validateRequest(DonationValidation.acceptBloodRequestSchema),
  DonationController.acceptBloodRequest
);
router3.get(
  "/:id/workspace",
  auth(Role.RECIPIENT, Role.ADMIN),
  BloodRequestController.getWorkspaceRequest
);
router3.get("/:id", BloodRequestController.getBloodRequestById);
router3.patch(
  "/:id",
  auth(),
  validateRequest(BloodRequestValidation.updateBloodRequestSchema),
  BloodRequestController.updateBloodRequest
);
router3.delete("/:id", auth(), BloodRequestController.deleteBloodRequest);
var BloodRequestRoutes = router3;

// src/app/module/donation/donation.route.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.get(
  "/my-history",
  auth(Role.DONOR),
  DonationController.getMyDonationHistory
);
router4.patch(
  "/:id/status",
  auth(),
  validateRequest(DonationValidation.updateDonationStatusSchema),
  DonationController.updateDonationStatus
);
var DonationRoutes = router4;

// src/app/module/payment/payment.route.ts
import express, { Router as Router5 } from "express";

// src/app/module/payment/payment.controller.ts
import httpStatus15 from "http-status";

// src/app/module/payment/payment.query.ts
import { z as z9 } from "zod";
var positiveInteger4 = (maximum, fallback) => z9.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z9.number().int().min(1).max(maximum)).default(fallback);
var PAYMENT_SORT_FIELDS = [
  "createdAt",
  "amountMinor",
  "status"
];
var myPaymentsQuerySchema = z9.object({
  page: positiveInteger4(1e6, 1),
  limit: positiveInteger4(50, 10),
  status: z9.nativeEnum(PaymentStatus).optional(),
  sortBy: z9.enum(PAYMENT_SORT_FIELDS).default("createdAt"),
  sortOrder: z9.enum(["asc", "desc"]).default("desc")
}).strict();

// src/app/module/payment/payment.service.ts
import { createHash, randomBytes } from "crypto";
import httpStatus14 from "http-status";

// src/app/utils/money.ts
var MIN_AMOUNT_MINOR = 1e3;
var MAX_AMOUNT_MINOR = 5e7;
var DECIMAL = /^\d{1,9}(\.\d{1,2})?$/;
var parseDecimalToMinor = (value) => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  const text2 = String(value).trim();
  if (!DECIMAL.test(text2)) return null;
  const [whole, fraction = ""] = text2.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (minor < MIN_AMOUNT_MINOR || minor > MAX_AMOUNT_MINOR) return null;
  return minor;
};
var formatMinor = (minor) => {
  const whole = Math.trunc(minor / 100);
  const fraction = String(minor % 100).padStart(2, "0");
  return `${whole}.${fraction}`;
};

// src/app/module/payment/stripe.client.ts
import Stripe from "stripe";
var REQUEST_TIMEOUT_MS = 15e3;
var StripeGatewayError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
  code;
};
var isTestModeKey = (key) => Boolean(key && /^(sk|rk)_test_[A-Za-z0-9]+$/.test(key));
var isWebhookConfigured = () => /^whsec_[A-Za-z0-9]+$/.test(config_default.stripe_webhook_secret ?? "");
var isStripeConfigured = () => isTestModeKey(config_default.stripe_secret_key) && Boolean(config_default.stripe_currency) && Boolean(config_default.frontend_url);
var isTrustedCheckoutUrl = (value) => {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (config_default.stripe_api_base_url) {
      try {
        if (host === new URL(config_default.stripe_api_base_url).hostname.toLowerCase())
          return true;
      } catch {
      }
    }
    return url.protocol === "https:" && host === "checkout.stripe.com";
  } catch {
    return false;
  }
};
var clientFor = (secretKey) => {
  const override = config_default.stripe_api_base_url;
  if (override) {
    const url = new URL(override);
    return new Stripe(secretKey, {
      host: url.hostname,
      port: url.port || (url.protocol === "https:" ? "443" : "80"),
      protocol: url.protocol.replace(":", ""),
      timeout: REQUEST_TIMEOUT_MS,
      maxNetworkRetries: 0
    });
  }
  return new Stripe(secretKey, {
    timeout: REQUEST_TIMEOUT_MS,
    maxNetworkRetries: 0
  });
};
var apiClient = () => {
  if (!isTestModeKey(config_default.stripe_secret_key)) {
    throw new StripeGatewayError("Stripe test-mode key is not configured");
  }
  return clientFor(config_default.stripe_secret_key);
};
var wrap = async (call) => {
  try {
    return await call();
  } catch (error) {
    throw new StripeGatewayError(
      error instanceof Error ? error.message : "Stripe request failed",
      error.code
    );
  }
};
var StripeGateway = {
  /** Verifies the Stripe-Signature header against the raw body. Throws before anything is parsed on a bad signature. */
  constructWebhookEvent(rawBody, signature) {
    if (!signature) throw new StripeGatewayError("Missing Stripe-Signature");
    try {
      return clientFor(
        isTestModeKey(config_default.stripe_secret_key) ? config_default.stripe_secret_key : "sk_test_webhook_verification_only"
      ).webhooks.constructEvent(
        rawBody,
        signature,
        config_default.stripe_webhook_secret
      );
    } catch (error) {
      throw new StripeGatewayError(
        error instanceof Error ? error.message : "Invalid signature"
      );
    }
  },
  retrieveCheckoutSession: (sessionId) => wrap(() => apiClient().checkout.sessions.retrieve(sessionId)),
  expireCheckoutSession: (sessionId) => wrap(() => apiClient().checkout.sessions.expire(sessionId)),
  /** Creates a hosted Checkout Session. Throws StripeGatewayError on any failure; never fabricates a session. */
  async createCheckoutSession(params) {
    if (!isTestModeKey(config_default.stripe_secret_key)) {
      throw new StripeGatewayError("Stripe test-mode key is not configured");
    }
    const stripe = clientFor(config_default.stripe_secret_key);
    let session;
    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          client_reference_id: params.paymentRecordId,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: params.currency,
                unit_amount: params.amountMinor,
                product_data: { name: "Emergency transport support" }
              }
            }
          ],
          metadata: {
            payment_record_id: params.paymentRecordId,
            request_id: params.requestId
          },
          success_url: params.successUrl,
          cancel_url: params.cancelUrl
        },
        {
          idempotencyKey: `checkout-${params.idempotencyKey}-${params.paymentRecordId}`
        }
      );
    } catch (error) {
      const code = error.code;
      throw new StripeGatewayError(
        error instanceof Error ? error.message : "Stripe request failed",
        code
      );
    }
    if (!session.id || !session.url) {
      throw new StripeGatewayError("Stripe returned an incomplete session");
    }
    if (!isTrustedCheckoutUrl(session.url)) {
      throw new StripeGatewayError("Stripe returned an untrusted checkout URL");
    }
    return { id: session.id, url: session.url };
  }
};

// src/app/module/payment/payment.service.ts
var RACE_ERROR_CODE = "P2002";
var toPaymentSummary = (payment) => ({
  id: payment.id,
  requestId: payment.requestId,
  status: payment.status,
  paymentMethod: payment.paymentMethod,
  currency: payment.currency,
  amount: formatMinor(payment.amountMinor),
  paymentId: payment.paymentId,
  createdAt: payment.createdAt
});
var fingerprintOf = (requestId, amountMinor) => createHash("sha256").update(`${requestId}|${amountMinor}`).digest("hex");
var initiateStripePayment = async (payerId, payload, idempotencyKey, ipAddress) => {
  const fingerprint = fingerprintOf(payload.requestId, payload.amountMinor);
  const replay = async () => {
    const existing = await prisma.payment.findUnique({
      where: { payerId_idempotencyKey: { payerId, idempotencyKey } }
    });
    if (!existing) return null;
    if (existing.initiationFingerprint !== fingerprint) {
      throw new AppError(
        httpStatus14.UNPROCESSABLE_ENTITY,
        "This Idempotency-Key was already used with a different request or amount"
      );
    }
    return {
      replayed: true,
      payment: toPaymentSummary(existing),
      checkoutUrl: existing.status === PaymentStatus.PENDING ? existing.checkoutUrl : null
    };
  };
  const replayed = await replay();
  if (replayed) return replayed;
  if (!isStripeConfigured()) {
    throw new AppError(
      httpStatus14.SERVICE_UNAVAILABLE,
      "Payments are temporarily unavailable"
    );
  }
  const bloodRequest = await prisma.bloodRequest.findUnique({
    where: { id: payload.requestId, isDeleted: false }
  });
  if (!bloodRequest) {
    throw new AppError(httpStatus14.NOT_FOUND, "Blood request not found");
  }
  if (bloodRequest.status === RequestStatus.CANCELLED) {
    throw new AppError(
      httpStatus14.BAD_REQUEST,
      "Cannot initiate payment for a cancelled blood request"
    );
  }
  const invoiceNumber = `INV-${Date.now()}-${randomBytes(4).toString("hex")}`;
  let attempt;
  try {
    attempt = await prisma.payment.create({
      data: {
        requestId: payload.requestId,
        payerId,
        amount: payload.amountMinor / 100,
        amountMinor: payload.amountMinor,
        currency: config_default.stripe_currency.toUpperCase(),
        paymentMethod: PaymentMethod.STRIPE,
        paymentId: `PENDING-${randomBytes(16).toString("hex")}`,
        merchantInvoiceNumber: invoiceNumber,
        idempotencyKey,
        initiationFingerprint: fingerprint,
        status: PaymentStatus.PENDING
      }
    });
  } catch (error) {
    if (error.code === RACE_ERROR_CODE) {
      const raced = await replay();
      if (raced) return raced;
    }
    throw error;
  }
  await prisma.auditLog.create({
    data: {
      userId: payerId,
      action: "PAYMENT_INITIATED",
      resource: "Payment",
      resourceId: attempt.id,
      details: {
        provider: "STRIPE",
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        requestId: attempt.requestId,
        merchantInvoiceNumber: invoiceNumber
      },
      ipAddress
    }
  });
  const returnUrl = (page) => {
    const url = new URL(`/payment/${page}`, config_default.frontend_url);
    url.searchParams.set("payment", attempt.id);
    return url.toString();
  };
  try {
    const session = await StripeGateway.createCheckoutSession({
      paymentRecordId: attempt.id,
      requestId: payload.requestId,
      amountMinor: payload.amountMinor,
      currency: config_default.stripe_currency.toLowerCase(),
      idempotencyKey,
      successUrl: returnUrl("success"),
      cancelUrl: returnUrl("cancel")
    });
    const updated = await prisma.payment.update({
      where: { id: attempt.id },
      data: { paymentId: session.id, checkoutUrl: session.url }
    });
    return {
      replayed: false,
      payment: toPaymentSummary(updated),
      checkoutUrl: session.url
    };
  } catch (error) {
    console.error(
      "Stripe checkout creation failed:",
      error instanceof Error ? error.message : error
    );
    const tooSmall = error instanceof StripeGatewayError && error.code === "amount_too_small";
    await prisma.payment.update({
      where: { id: attempt.id },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: tooSmall ? "Amount is below the minimum the payment provider accepts" : "Gateway could not create a checkout session"
      }
    });
    await prisma.auditLog.create({
      data: {
        userId: payerId,
        action: "PAYMENT_FAILED",
        resource: "Payment",
        resourceId: attempt.id,
        details: {
          stage: "initiation",
          reason: tooSmall ? "amount_too_small" : "gateway_error"
        },
        ipAddress
      }
    });
    throw tooSmall ? new AppError(
      httpStatus14.BAD_REQUEST,
      "That amount is below the minimum the payment provider accepts. Please enter a larger amount."
    ) : new AppError(
      httpStatus14.BAD_GATEWAY,
      "The payment gateway could not start checkout. Please try again."
    );
  }
};
var OUTCOME_BY_STATUS = {
  [PaymentStatus.COMPLETED]: "completed",
  [PaymentStatus.CANCELLED]: "cancelled",
  [PaymentStatus.FAILED]: "failed",
  [PaymentStatus.PENDING]: "pending"
};
var toOutcomeResult = (payment) => ({
  outcome: OUTCOME_BY_STATUS[payment.status],
  payment: {
    ...toPaymentSummary(payment),
    transactionId: payment.transactionId,
    failureReason: payment.failureReason
  }
});
var PENDING_PREFIX = "PENDING-";
var sessionMatchesPayment = (payment, session) => session.payment_status === "paid" && session.amount_total === payment.amountMinor && session.currency?.toUpperCase() === payment.currency && (session.id === payment.paymentId || payment.paymentId.startsWith(PENDING_PREFIX) && session.client_reference_id === payment.id);
var paymentIntentId = (session) => typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
var settlePending = async (payment, next, ipAddress) => {
  const claimed = await prisma.payment.updateMany({
    where: { id: payment.id, status: PaymentStatus.PENDING },
    data: {
      status: next.status,
      ...next.reason ? { failureReason: next.reason } : {},
      ...next.transactionId ? { transactionId: next.transactionId } : {},
      ...next.sessionId ? { paymentId: next.sessionId } : {},
      ...next.gatewayRecord ? { paymentExecuteResponse: next.gatewayRecord } : {}
    }
  });
  const current = await prisma.payment.findUnique({
    where: { id: payment.id },
    include: { payer: { select: { id: true, name: true, email: true } } }
  });
  if (!current) {
    throw new AppError(httpStatus14.NOT_FOUND, "Payment transaction not found");
  }
  if (claimed.count === 0) return current;
  await prisma.auditLog.create({
    data: {
      userId: payment.payerId,
      action: next.action,
      resource: "Payment",
      resourceId: payment.id,
      details: {
        provider: payment.paymentMethod,
        status: next.status,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        ...next.transactionId ? { transactionId: next.transactionId } : {},
        ...next.reason ? { reason: next.reason } : {}
      },
      ipAddress
    }
  });
  if (next.status === PaymentStatus.COMPLETED && current.payer?.email) {
    sendEmail({
      to: current.payer.email,
      subject: `Payment Receipt: ${formatMinor(current.amountMinor)} ${current.currency}`,
      html: paymentReceiptEmailHtml(
        current.payer.name,
        formatMinor(current.amountMinor),
        current.currency,
        current.transactionId || current.paymentId,
        current.paymentId
      )
    }).catch(
      (err) => console.error("Payment receipt email dispatch error:", err)
    );
  }
  return current;
};
var settlePaidSession = (payment, session, ipAddress) => sessionMatchesPayment(payment, session) ? settlePending(
  payment,
  {
    status: PaymentStatus.COMPLETED,
    action: "PAYMENT_COMPLETED",
    transactionId: paymentIntentId(session) ?? session.id,
    sessionId: session.id,
    gatewayRecord: {
      sessionId: session.id,
      paymentIntent: paymentIntentId(session),
      amountTotal: session.amount_total,
      currency: session.currency
    }
  },
  ipAddress
) : settlePending(
  payment,
  {
    status: PaymentStatus.FAILED,
    action: "PAYMENT_VERIFICATION_FAILED",
    reason: "Gateway response did not match the payment"
  },
  ipAddress
);
var findPaymentForSession = async (session) => {
  const bySession = await prisma.payment.findUnique({
    where: { paymentId: session.id }
  });
  if (bySession) return bySession;
  if (session.client_reference_id) {
    const byReference = await prisma.payment.findUnique({
      where: { id: session.client_reference_id }
    });
    if (byReference?.paymentId.startsWith(PENDING_PREFIX)) return byReference;
  }
  return null;
};
var HANDLED_STRIPE_EVENTS = /* @__PURE__ */ new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired"
]);
var handleStripeEvent = async (event, ipAddress) => {
  if (!HANDLED_STRIPE_EVENTS.has(event.type)) return { handled: false };
  const seen = await prisma.paymentWebhookEvent.findUnique({
    where: { id: event.id }
  });
  if (seen) return { handled: true, duplicate: true };
  const session = event.data.object;
  const payment = await findPaymentForSession(session);
  if (!payment) {
    console.error(
      "Stripe webhook for an unknown checkout session:",
      session.id
    );
  } else if (payment.status === PaymentStatus.PENDING) {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      if (session.payment_status === "paid") {
        await settlePaidSession(payment, session, ipAddress);
      }
    } else {
      await settlePending(
        payment,
        {
          status: PaymentStatus.FAILED,
          action: "PAYMENT_FAILED",
          reason: event.type === "checkout.session.expired" ? "Checkout session expired" : "Payment could not be completed"
        },
        ipAddress
      );
    }
  }
  try {
    await prisma.paymentWebhookEvent.create({
      data: { id: event.id, type: event.type }
    });
  } catch (error) {
    if (error.code !== RACE_ERROR_CODE) throw error;
  }
  return { handled: true, duplicate: false };
};
var reconcileStripePayment = async (payment, ipAddress) => {
  if (payment.paymentMethod !== PaymentMethod.STRIPE || payment.status !== PaymentStatus.PENDING || !payment.paymentId.startsWith("cs_")) {
    return false;
  }
  let session;
  try {
    session = await StripeGateway.retrieveCheckoutSession(payment.paymentId);
  } catch {
    return false;
  }
  if (session.payment_status === "paid") {
    await settlePaidSession(payment, session, ipAddress);
    return true;
  }
  if (session.status === "expired") {
    await settlePending(
      payment,
      {
        status: PaymentStatus.FAILED,
        action: "PAYMENT_FAILED",
        reason: "Checkout session expired"
      },
      ipAddress
    );
    return true;
  }
  return false;
};
var loadAuthorizedPayment = async (paymentIdOrRecordId, userId, userRole) => {
  const payment = await prisma.payment.findFirst({
    where: {
      OR: [{ id: paymentIdOrRecordId }, { paymentId: paymentIdOrRecordId }]
    }
  });
  if (!payment) {
    throw new AppError(httpStatus14.NOT_FOUND, "Payment record not found");
  }
  if (userRole !== Role.ADMIN && payment.payerId !== userId) {
    throw new AppError(
      httpStatus14.FORBIDDEN,
      "You do not have permission to view this payment record"
    );
  }
  return payment;
};
var cancelStripePayment = async (paymentIdOrRecordId, userId, userRole, ipAddress) => {
  const payment = await loadAuthorizedPayment(
    paymentIdOrRecordId,
    userId,
    userRole
  );
  if (payment.status !== PaymentStatus.PENDING) return toOutcomeResult(payment);
  if (payment.paymentMethod !== PaymentMethod.STRIPE || !payment.paymentId.startsWith("cs_")) {
    return toOutcomeResult(payment);
  }
  try {
    let session = await StripeGateway.retrieveCheckoutSession(
      payment.paymentId
    );
    if (session.payment_status === "paid") {
      return toOutcomeResult(
        await settlePaidSession(payment, session, ipAddress)
      );
    }
    if (session.status === "open") {
      session = await StripeGateway.expireCheckoutSession(payment.paymentId);
    }
    if (session.status === "expired" && session.payment_status !== "paid") {
      return toOutcomeResult(
        await settlePending(
          payment,
          { status: PaymentStatus.CANCELLED, action: "PAYMENT_CANCELLED" },
          ipAddress
        )
      );
    }
    return toOutcomeResult(payment);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      httpStatus14.BAD_GATEWAY,
      "The payment gateway could not confirm this payment yet. Please try again."
    );
  }
};
var getMyPayments = async (payerId, filters) => {
  const { page, limit, status, sortBy, sortOrder } = filters;
  const where = { payerId, ...status ? { status } : {} };
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
      select: {
        id: true,
        requestId: true,
        status: true,
        paymentMethod: true,
        currency: true,
        amountMinor: true,
        paymentId: true,
        transactionId: true,
        failureReason: true,
        createdAt: true,
        request: {
          select: { id: true, bloodGroup: true, hospitalName: true }
        }
      }
    })
  ]);
  return {
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    result: rows.map(({ request, ...row }) => ({
      ...toPaymentSummary(row),
      transactionId: row.transactionId,
      failureReason: row.failureReason,
      request
    }))
  };
};
var getPaymentById = async (paymentIdOrRecordId, userId, userRole, ipAddress) => {
  const load = () => prisma.payment.findFirst({
    where: {
      OR: [{ id: paymentIdOrRecordId }, { paymentId: paymentIdOrRecordId }]
    },
    omit: {
      paymentExecuteResponse: true,
      idempotencyKey: true,
      initiationFingerprint: true,
      checkoutUrl: true
    },
    include: {
      request: {
        select: {
          id: true,
          patientName: true,
          bloodGroup: true,
          hospitalName: true,
          hospitalAddress: true,
          urgency: true,
          status: true
        }
      },
      payer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true
        }
      }
    }
  });
  let payment = await load();
  if (!payment) {
    throw new AppError(httpStatus14.NOT_FOUND, "Payment record not found");
  }
  if (userRole !== Role.ADMIN && payment.payerId !== userId) {
    throw new AppError(
      httpStatus14.FORBIDDEN,
      "You do not have permission to view this payment record"
    );
  }
  if (await reconcileStripePayment(payment, ipAddress)) {
    payment = await load() ?? payment;
  }
  return payment;
};
var PaymentService = {
  getMyPayments,
  initiateStripePayment,
  handleStripeEvent,
  cancelStripePayment,
  getPaymentById
};

// src/app/module/payment/payment.validation.ts
import { z as z10 } from "zod";
var amountSchema = z10.union([z10.string(), z10.number()]).transform((value, ctx) => {
  const minor = parseDecimalToMinor(value);
  if (minor === null) {
    ctx.addIssue({
      code: "custom",
      message: `Amount must be a BDT value with at most two decimals between ${formatMinor(MIN_AMOUNT_MINOR)} and ${formatMinor(MAX_AMOUNT_MINOR)}`
    });
    return z10.NEVER;
  }
  return minor;
});
var createPaymentSchema = z10.object({
  body: z10.object({
    requestId: z10.string().uuid("Valid blood request ID (UUID) is required"),
    amount: amountSchema
  }).strict().transform(({ requestId, amount }) => ({ requestId, amountMinor: amount }))
});
var idempotencyKeySchema = z10.string().regex(
  /^[A-Za-z0-9_-]{16,64}$/,
  "Idempotency-Key must be 16-64 characters: letters, digits, '-' or '_'"
);
var PaymentValidation = {
  createPaymentSchema
};

// src/app/module/payment/payment.controller.ts
var initiateStripePayment2 = catchAsync(
  async (req, res) => {
    const payerId = req.user.userId;
    const key = idempotencyKeySchema.safeParse(req.get("idempotency-key"));
    if (!key.success) {
      throw new AppError(
        httpStatus15.BAD_REQUEST,
        "A valid Idempotency-Key header (16-64 characters: letters, digits, '-' or '_') is required"
      );
    }
    const { replayed, ...data } = await PaymentService.initiateStripePayment(
      payerId,
      req.body,
      key.data,
      req.ip
    );
    res.setHeader("Cache-Control", "no-store");
    sendResponse(res, {
      statusCode: replayed ? httpStatus15.OK : httpStatus15.CREATED,
      success: true,
      message: replayed ? "Payment attempt already exists" : "Stripe checkout started successfully",
      data
    });
  }
);
var retiredBkashCreate = (_req, res) => {
  res.status(httpStatus15.GONE).json({
    success: false,
    message: "bKash checkout has been retired. Use POST /api/v1/payments/stripe/checkout.",
    errors: []
  });
};
var handleStripeWebhook = catchAsync(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!isWebhookConfigured()) {
    throw new AppError(
      httpStatus15.SERVICE_UNAVAILABLE,
      "Webhook receiving is not configured"
    );
  }
  if (!Buffer.isBuffer(req.body)) {
    throw new AppError(httpStatus15.BAD_REQUEST, "Invalid webhook payload");
  }
  let event;
  try {
    event = StripeGateway.constructWebhookEvent(
      req.body,
      req.get("stripe-signature")
    );
  } catch {
    throw new AppError(httpStatus15.BAD_REQUEST, "Invalid webhook signature");
  }
  await PaymentService.handleStripeEvent(event, req.ip);
  res.status(httpStatus15.OK).json({ received: true });
});
var cancelStripePayment2 = catchAsync(async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const result = await PaymentService.cancelStripePayment(
    req.params.id,
    req.user.userId,
    req.user.role,
    req.ip
  );
  sendResponse(res, {
    statusCode: httpStatus15.OK,
    success: true,
    message: `Payment ${result.outcome}`,
    data: result
  });
});
var getMyPayments2 = catchAsync(async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const filters = myPaymentsQuerySchema.parse(req.query);
  const result = await PaymentService.getMyPayments(req.user.userId, filters);
  sendResponse(res, {
    statusCode: httpStatus15.OK,
    success: true,
    message: "Payments retrieved successfully",
    data: result
  });
});
var getPaymentById2 = catchAsync(async (req, res) => {
  const id = req.params.id;
  const userId = req.user.userId;
  const userRole = req.user.role;
  const result = await PaymentService.getPaymentById(
    id,
    userId,
    userRole,
    req.ip
  );
  sendResponse(res, {
    statusCode: httpStatus15.OK,
    success: true,
    message: "Payment details retrieved successfully",
    data: result
  });
});
var PaymentController = {
  retiredBkashCreate,
  getMyPayments: getMyPayments2,
  initiateStripePayment: initiateStripePayment2,
  handleStripeWebhook,
  cancelStripePayment: cancelStripePayment2,
  getPaymentById: getPaymentById2
};

// src/app/module/payment/payment.route.ts
var stripeWebhookBodyParser = express.raw({
  type: "application/json",
  limit: "1mb"
});
var router5 = Router5();
router5.post(
  "/stripe/checkout",
  auth(Role.RECIPIENT, Role.ADMIN),
  validateRequest(PaymentValidation.createPaymentSchema),
  PaymentController.initiateStripePayment
);
router5.post("/bkash/create", PaymentController.retiredBkashCreate);
router5.post("/stripe/webhook", PaymentController.handleStripeWebhook);
router5.get(
  "/mine",
  auth(Role.RECIPIENT, Role.ADMIN),
  PaymentController.getMyPayments
);
router5.post("/:id/cancel", auth(), PaymentController.cancelStripePayment);
router5.get("/:id", auth(), PaymentController.getPaymentById);
var PaymentRoutes = router5;

// src/app/module/user/user.route.ts
import { Router as Router6 } from "express";

// src/app/module/user/user.controller.ts
import httpStatus17 from "http-status";

// src/app/module/user/user.service.ts
import httpStatus16 from "http-status";
var getMyProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, isDeleted: false },
    include: {
      donorProfile: true
    },
    omit: {
      password: true
    }
  });
  if (!user) {
    throw new AppError(httpStatus16.NOT_FOUND, "User profile not found");
  }
  return user;
};
var updateMyProfile = async (userId, payload) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, isDeleted: false }
  });
  if (!user) {
    throw new AppError(httpStatus16.NOT_FOUND, "User profile not found");
  }
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...payload.name !== void 0 && { name: payload.name },
      ...payload.phone !== void 0 && { phone: payload.phone },
      ...payload.address !== void 0 && { address: payload.address }
    },
    include: {
      donorProfile: true
    },
    omit: {
      password: true
    }
  });
  return updatedUser;
};
var updateDonorProfile = async (userId, payload) => {
  const user = await prisma.user.findUnique({
    where: { id: userId, isDeleted: false }
  });
  if (!user) {
    throw new AppError(httpStatus16.NOT_FOUND, "User not found");
  }
  if (user.role !== Role.DONOR) {
    throw new AppError(
      httpStatus16.FORBIDDEN,
      "Only donors can manage a donor profile"
    );
  }
  const parsedDate = payload.lastDonationDate !== void 0 ? payload.lastDonationDate ? new Date(payload.lastDonationDate) : null : void 0;
  const updateData = {
    ...payload.bloodGroup !== void 0 && { bloodGroup: payload.bloodGroup },
    ...payload.isAvailable !== void 0 && {
      isAvailable: payload.isAvailable
    },
    ...parsedDate !== void 0 && { lastDonationDate: parsedDate },
    ...payload.phone !== void 0 && { phone: payload.phone },
    ...payload.address !== void 0 && { address: payload.address },
    ...payload.latitude !== void 0 && { latitude: payload.latitude },
    ...payload.longitude !== void 0 && { longitude: payload.longitude }
  };
  const updatedDonorProfile = await prisma.donorProfile.upsert({
    where: { userId },
    update: updateData,
    create: {
      userId,
      ...updateData
    }
  });
  await Promise.all([
    cache.delByPattern("cache:matching-donors:*"),
    cache.del("cache:admin:dashboard-stats")
  ]);
  return updatedDonorProfile;
};
var UserService = {
  getMyProfile,
  updateMyProfile,
  updateDonorProfile
};

// src/app/module/user/user.controller.ts
var getMyProfile2 = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const result = await UserService.getMyProfile(userId);
  sendResponse(res, {
    statusCode: httpStatus17.OK,
    success: true,
    message: "User profile fetched successfully",
    data: result
  });
});
var updateMyProfile2 = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const result = await UserService.updateMyProfile(userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus17.OK,
    success: true,
    message: "User profile updated successfully",
    data: result
  });
});
var updateDonorProfile2 = catchAsync(async (req, res) => {
  const userId = req.user.userId;
  const result = await UserService.updateDonorProfile(userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus17.OK,
    success: true,
    message: "Donor profile updated successfully",
    data: result
  });
});
var UserController = {
  getMyProfile: getMyProfile2,
  updateMyProfile: updateMyProfile2,
  updateDonorProfile: updateDonorProfile2
};

// src/app/module/user/user.validation.ts
import { z as z11 } from "zod";
var updateProfileValidationSchema = z11.object({
  body: z11.object({
    name: z11.string().min(2, "Name must be at least 2 characters").optional(),
    phone: z11.string().optional(),
    address: z11.string().optional()
  })
});
var updateDonorProfileValidationSchema = z11.object({
  body: z11.object({
    bloodGroup: z11.nativeEnum(BloodGroup, {
      error: "Invalid blood group"
    }).optional(),
    isAvailable: z11.boolean().optional(),
    lastDonationDate: z11.string().refine((val) => !Number.isNaN(Date.parse(val)), {
      message: "Invalid date format for lastDonationDate (e.g. YYYY-MM-DD or ISO string)"
    }).optional().nullable(),
    phone: z11.string().optional(),
    address: z11.string().optional(),
    latitude: z11.number().min(-90, "Latitude must be >= -90").max(90, "Latitude must be <= 90").optional(),
    longitude: z11.number().min(-180, "Longitude must be >= -180").max(180, "Longitude must be <= 180").optional()
  })
});
var UserValidation = {
  updateProfileValidationSchema,
  updateDonorProfileValidationSchema
};

// src/app/module/user/user.route.ts
var router6 = Router6();
router6.get("/me", auth(), UserController.getMyProfile);
router6.patch(
  "/me",
  auth(),
  validateRequest(UserValidation.updateProfileValidationSchema),
  UserController.updateMyProfile
);
router6.patch(
  "/donor-profile",
  auth(Role.DONOR),
  validateRequest(UserValidation.updateDonorProfileValidationSchema),
  UserController.updateDonorProfile
);
var UserRoutes = router6;

// src/app.ts
var app = express2();
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(globalRateLimiter);
app.use(
  cors({
    origin: config_default.frontend_url || "*",
    credentials: true
  })
);
app.use(express2.urlencoded({ extended: true }));
app.use("/api/v1/payments/stripe/webhook", stripeWebhookBodyParser);
app.use(express2.json());
app.use(cookieParser());
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/users", UserRoutes);
app.use("/api/v1/blood-requests", BloodRequestRoutes);
app.use("/api/v1/donations", DonationRoutes);
app.use("/api/v1/payments", PaymentRoutes);
app.use("/api/v1/admin", AdminRoutes);
app.get("/", (_req, res) => {
  res.status(httpStatus18.OK).json({
    success: true,
    message: "Welcome to Blood Donation & Emergency Platform Backend API",
    data: {
      version: "v1.0.0",
      status: "active",
      docs: "Import postman collections from ./postman/ to test each phase"
    }
  });
});
app.use(globalErrorHandler);
app.use(notFound);
var app_default = app;

// src/server.ts
var PORT = config_default.port || 5e3;
var main = async () => {
  try {
    await prisma.$connect();
    console.log("Connected to the database successfully.");
    app_default.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error starting the server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};
if (!process.env.VERCEL) {
  main();
}
var server_default = app_default;
export {
  server_default as default
};
//# sourceMappingURL=server.js.map