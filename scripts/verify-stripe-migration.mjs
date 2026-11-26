// Usage: npm i --no-save @electric-sql/pglite && node scripts/verify-stripe-migration.mjs <before-schema.sql> <hardening migration.sql> <stripe migration.sql>
import fs from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
const [beforeFile, m1, m2] = process.argv.slice(2);
const db = new PGlite();
await db.exec(fs.readFileSync(beforeFile, "utf8"));
await db.exec("SET session_replication_role = 'replica'");
await db.query(`INSERT INTO "payments" ("id","requestId","payerId","amount","paymentMethod","paymentId","transactionId","status","updatedAt") VALUES ('p1','r','u',150.5,'BKASH','BK-1','TRX','COMPLETED',now())`);
await db.exec(fs.readFileSync(m1, "utf8"));
await db.exec(fs.readFileSync(m2, "utf8"));
const rows = (await db.query(`SELECT "paymentMethod","amountMinor","paymentId" FROM payments`)).rows;
assert.deepEqual(rows, [{ paymentMethod: "BKASH", amountMinor: 15050, paymentId: "BK-1" }]);
await db.query(`INSERT INTO "payments" ("id","requestId","payerId","amount","amountMinor","paymentMethod","paymentId","status","updatedAt") VALUES ('p2','r','u',10,1000,'STRIPE','cs_test_1','PENDING',now())`);
await db.query(`INSERT INTO "payment_webhook_events" ("id","type") VALUES ('evt_1','checkout.session.completed')`);
await assert.rejects(() => db.query(`INSERT INTO "payment_webhook_events" ("id","type") VALUES ('evt_1','x')`), /duplicate key|payment_webhook_events_pkey/);
console.log("stripe migration verified: legacy bKash row intact, STRIPE row + unique webhook events OK");
