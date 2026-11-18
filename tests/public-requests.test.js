import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import { prisma } from "../src/app/lib/prisma";
import { cache } from "../src/app/lib/redis";
import { BloodRequestController } from "../src/app/module/bloodRequest/bloodRequest.controller";
import { globalErrorHandler } from "../src/app/middleware/globalErrorHandler";

const id = "550e8400-e29b-41d4-a716-446655440000";
const publicFields = ["id", "patientName", "bloodGroup", "unitsNeeded", "unitsFulfilled", "hospitalName", "hospitalAddress", "urgency", "status", "createdAt", "updatedAt"].sort();
const row = {
  id, patientName: "Test patient", bloodGroup: "A_POS", unitsNeeded: 2,
  unitsFulfilled: 0, hospitalName: "Test hospital", hospitalAddress: "Dhaka",
  urgency: "NORMAL", status: "OPEN", createdAt: new Date(), updatedAt: new Date(),
  contactNumber: "private-phone", requesterId: "private-id", latitude: 23, longitude: 90,
  notes: "private notes", requester: { email: "private@example.test" },
  assignments: [{ donor: { donorProfile: { private: true } } }],
};

test("public HTTP list/detail enforce projections, reject bad queries before DB access, and bypass old cache", async (t) => {
  t.after(() => cache.close());
  let reads = 0;
  const saved = new Map();
  t.mock.method(cache, "get", async (key) => {
    assert.match(key, /^cache:blood-requests:public-v2:/);
    return saved.get(key) ?? null;
  });
  t.mock.method(cache, "set", async (key, value) => { saved.set(key, value); });
  function project(args) {
    reads++;
    assert.deepEqual(Object.keys(args.select).sort(), publicFields);
    if (args.where?.id && args.where.id !== id) return null;
    return Object.fromEntries(Object.entries(row).filter(([key]) => args.select[key]));
  }
  const originalMethods = { count: prisma.bloodRequest.count, findMany: prisma.bloodRequest.findMany, findUnique: prisma.bloodRequest.findUnique };
  t.after(() => Object.assign(prisma.bloodRequest, originalMethods));
  prisma.bloodRequest.count = async () => 1;
  prisma.bloodRequest.findMany = async (args) => { assert(Array.isArray(args.orderBy)); assert.deepEqual(args.orderBy[1], { id: "asc" }); return [project(args)]; };
  prisma.bloodRequest.findUnique = async (args) => project(args);
  const app = express();
  app.get("/requests", BloodRequestController.getAllBloodRequests);
  app.get("/requests/:id", BloodRequestController.getBloodRequestById);
  app.use(globalErrorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/requests`;
  try {
    for (const path of ["?limit=2&page=1&sortBy=urgency&sortOrder=asc", `/${id}`]) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200);
      const body = await response.json();
      const result = body.data.result?.[0] ?? body.data;
      assert.deepEqual(Object.keys(result).sort(), publicFields);
      assert(!JSON.stringify(body).includes("private"));
    }
    const before = reads;
    for (const query of ["page=0", "page=-1", "page=1.5", "page=Infinity", "page=1000001", "limit=101", "limit=", "page=1&page=2", "bloodGroup=BAD", "urgency=BAD", "status=BAD", "sortBy=password", "sortOrder=bad", "requesterId=someone", "searchTerm=" + "a".repeat(201)]) {
      const response = await fetch(`${base}?${query}`);
      assert.equal(response.status, 400, query);
    }
    assert.equal(reads, before);
    assert.equal((await fetch(`${base}/not-a-uuid`)).status, 400);
    assert.equal((await fetch(`${base}/550e8400-e29b-41d4-a716-446655440001`)).status, 404);
    const first = await (await fetch(base)).json();
    const second = await (await fetch(base)).json();
    assert.deepEqual(first, second);
    assert.deepEqual(first.data.meta, { page: 1, limit: 10, total: 1, totalPages: 1 });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.$disconnect();
  }
});
