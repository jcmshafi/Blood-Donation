// Usage: npm i --no-save @electric-sql/pglite && node scripts/verify-payment-migration.mjs <before-schema.sql> prisma/migrations/20261126090000_payment_hardening_fields/migration.sql
// Applies the pre-change schema (before.sql, generated from the previous Prisma schema), seeds legacy bKash payments, then runs the new migration and checks the result.
import fs from "node:fs";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const [beforeFile, migrationFile] = process.argv.slice(2);
const db = new PGlite();
await db.exec(fs.readFileSync(beforeFile, "utf8"));

// Seed with foreign keys relaxed: only the payments rows matter for this check.
await db.exec("SET session_replication_role = 'replica'");
const amounts = [150.5, 99.99, 0.1, 1234567.89, 10, 33.335];
for (const [index, amount] of amounts.entries()) {
  await db.query(
    `INSERT INTO "payments" ("id","requestId","payerId","amount","paymentMethod","paymentId","transactionId","status","updatedAt")
     VALUES ($1,'req-1','payer-1',$2,'BKASH',$3,$4,'COMPLETED',now())`,
    [`pay-${index}`, amount, `BK-${index}`, `TRX-${index}`],
  );
}
await db.exec("SET session_replication_role = 'origin'");
const legacy = (await db.query(`SELECT "id","amount","paymentId","transactionId","status" FROM "payments" ORDER BY "id"`)).rows;
assert.equal(legacy.length, amounts.length);

await db.exec(fs.readFileSync(migrationFile, "utf8"));

const after = (await db.query(`SELECT * FROM "payments" ORDER BY "id"`)).rows;
assert.equal(after.length, amounts.length, "no rows lost");
for (const row of after) {
  const before = legacy.find((item) => item.id === row.id);
  assert.equal(row.amount, before.amount, "legacy amount untouched");
  assert.equal(row.paymentId, before.paymentId);
  assert.equal(row.transactionId, before.transactionId);
  assert.equal(row.status, before.status);
  assert.equal(row.paymentMethod, "BKASH");
  assert.equal(row.currency, "BDT");
  for (const column of ["merchantInvoiceNumber", "checkoutUrl", "idempotencyKey", "initiationFingerprint", "failureReason"]) {
    assert.equal(row[column], null, column);
  }
}
const minor = Object.fromEntries(after.map((row) => [row.paymentId, row.amountMinor]));
assert.deepEqual(minor, { "BK-0": 15050, "BK-1": 9999, "BK-2": 10, "BK-3": 123456789, "BK-4": 1000, "BK-5": 3334 });

// New column is required, and the old detail-style read still works.
const column = (await db.query(`SELECT is_nullable FROM information_schema.columns WHERE table_name='payments' AND column_name='amountMinor'`)).rows[0];
assert.equal(column.is_nullable, "NO");
assert.equal((await db.query(`SELECT * FROM "payments" WHERE "id"='pay-0' OR "paymentId"='pay-0'`)).rows.length, 1);

// New rows: idempotency keys are unique per payer; NULL keys never collide.
await db.exec("SET session_replication_role = 'replica'");
const insert = (id, payer, key, session) =>
  db.query(
    `INSERT INTO "payments" ("id","requestId","payerId","amount","amountMinor","paymentMethod","paymentId","merchantInvoiceNumber","idempotencyKey","status","updatedAt")
     VALUES ($1,'req-1',$2,150.5,15050,'BKASH',$3,$4,$5,'PENDING',now())`,
    [id, payer, `BK-${id}`, session, key],
  );
await insert("n1", "payer-1", "key-aaaa1111", "sess-1");
await insert("n2", "payer-2", "key-aaaa1111", "sess-2"); // same key, different payer
await insert("n3", "payer-1", null, null);
await insert("n4", "payer-1", null, null).catch(() => assert.fail("NULL keys must not collide"));
await assert.rejects(() => insert("n5", "payer-1", "key-aaaa1111", "sess-5"), /payments_payerId_idempotencyKey_key/);
await assert.rejects(() => insert("n6", "payer-3", "key-bbbb2222", "sess-1"), /payments_merchantInvoiceNumber_key/);

console.log("migration verified:", JSON.stringify({ rows: after.length, amountMinor: minor }));
