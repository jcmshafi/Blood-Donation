import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "../src/app/lib/prisma";
import { cache } from "../src/app/lib/redis";
import { jwtUtils } from "../src/app/utils/jwt";
import { BloodRequestRoutes } from "../src/app/module/bloodRequest/bloodRequest.route";
import { globalErrorHandler } from "../src/app/middleware/globalErrorHandler";
import { publicRequestSelect } from "../src/app/module/bloodRequest/bloodRequest.public";

test("owned HTTP list enforces verified ownership, strict queries, pagination and global summary", async (t) => {
	t.after(async () => {
		cache.close();
		await prisma.$disconnect();
	});
	const users = {
		alice: {
			id: "alice",
			role: "RECIPIENT",
			status: "ACTIVE",
			isDeleted: false,
		},
		bob: { id: "bob", role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		admin: { id: "admin", role: "ADMIN", status: "ACTIVE", isDeleted: false },
		donor: { id: "donor", role: "DONOR", status: "ACTIVE", isDeleted: false },
		blocked: {
			id: "blocked",
			role: "RECIPIENT",
			status: "BLOCKED",
			isDeleted: false,
		},
		deleted: {
			id: "deleted",
			role: "RECIPIENT",
			status: "ACTIVE",
			isDeleted: true,
		},
	};
	const rows = [
		{
			id: "a1",
			requesterId: "alice",
			status: "OPEN",
			isDeleted: false,
			unitsNeeded: 2,
		},
		{
			id: "a2",
			requesterId: "alice",
			status: "OPEN",
			isDeleted: false,
			unitsNeeded: 3,
		},
		{
			id: "a3",
			requesterId: "alice",
			status: "FULFILLED",
			isDeleted: false,
			unitsNeeded: 1,
		},
		{
			id: "a4",
			requesterId: "alice",
			status: "OPEN",
			isDeleted: true,
			unitsNeeded: 4,
		},
		{
			id: "b1",
			requesterId: "bob",
			status: "CANCELLED",
			isDeleted: false,
			unitsNeeded: 2,
		},
	];
	t.mock.method(jwtUtils, "verifyToken", (token) => ({
		success: Boolean(users[token]),
		data: { userId: token, role: "ADMIN" },
	}));
	const originalFind = prisma.user.findUnique;
	prisma.user.findUnique = async ({ where }) => users[where.id];
	t.after(() => {
		prisma.user.findUnique = originalFind;
	});
	let reads = 0;
	const match = (where) => {
		assert.equal(where.isDeleted, false);
		assert.ok(users[where.requesterId], "every query must be owner scoped");
		return rows.filter(
			(row) =>
				row.requesterId === where.requesterId &&
				!row.isDeleted &&
				(!where.status || row.status === where.status),
		);
	};
	const originalTransaction = prisma.$transaction;
	t.after(() => {
		prisma.$transaction = originalTransaction;
	});
	prisma.$transaction = async (callback, options) => {
		reads++;
		assert.equal(options.isolationLevel, "RepeatableRead");
		return callback({
			bloodRequest: {
				count: async ({ where }) => match(where).length,
				findMany: async ({ where, skip, take, orderBy, select }) => {
					assert.deepEqual(select, publicRequestSelect);
					assert.deepEqual(orderBy[1], { id: "asc" });
					return match(where)
						.slice(skip, skip + take)
						.map((row) => ({ id: row.id, status: row.status }));
				},
				groupBy: async ({ where }) => {
					assert.deepEqual(Object.keys(where).sort(), [
						"isDeleted",
						"requesterId",
					]);
					const counts = {};
					for (const row of match(where))
						counts[row.status] = (counts[row.status] || 0) + 1;
					return Object.entries(counts).map(([status, count]) => ({
						status,
						_count: { _all: count },
					}));
				},
			},
		});
	};
	t.mock.method(cache, "get", async () => {
		assert.fail("owned reads must not use shared cache");
	});
	const app = express();
	app.use(cookieParser());
	app.use("/requests", BloodRequestRoutes);
	app.use(globalErrorHandler);
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const base = `http://127.0.0.1:${server.address().port}/requests/mine`;
	const get = (token, query = "") =>
		fetch(base + query, {
			headers: token ? { authorization: `Bearer ${token}` } : {},
		});
	for (const [token, status] of [
		[null, 401],
		["invalid", 401],
		["donor", 403],
		["blocked", 403],
		["deleted", 401],
	]) {
		assert.equal((await get(token)).status, status);
	}
	assert.equal(reads, 0);
	const first = await get("alice", "?status=OPEN&limit=1&page=1");
	assert.equal(first.status, 200, "static /mine must precede /:id");
	assert.equal(first.headers.get("cache-control"), "private, no-store");
	const a = (await first.json()).data;
	assert.deepEqual(a.meta, { page: 1, limit: 1, total: 2, totalPages: 2 });
	assert.deepEqual(
		a.result.map((row) => row.id),
		["a1"],
	);
	assert.deepEqual(a.summary, {
		total: 3,
		open: 2,
		matched: 0,
		fulfilled: 1,
		cancelled: 0,
	});
	const second = (
		await (await get("alice", "?status=OPEN&limit=1&page=2")).json()
	).data;
	assert.deepEqual(
		second.result.map((row) => row.id),
		["a2"],
	);
	assert.deepEqual(second.summary, a.summary);
	const empty = (await (await get("alice", "?status=CANCELLED&page=99")).json())
		.data;
	assert.deepEqual(empty.result, []);
	assert.equal(empty.meta.total, 0);
	assert.deepEqual(empty.summary, a.summary);
	const b = (await (await get("bob")).json()).data;
	assert.deepEqual(
		b.result.map((row) => row.id),
		["b1"],
	);
	assert.deepEqual(b.summary, {
		total: 1,
		open: 0,
		matched: 0,
		fulfilled: 0,
		cancelled: 1,
	});
	const admin = (await (await get("admin")).json()).data;
	assert.equal(
		admin.summary.total,
		0,
		"admin /mine must not return everybody's records",
	);
	const before = reads;
	for (const query of [
		"requesterId=bob",
		"userId=bob",
		"page=0",
		"page=1&page=2",
		"limit=101",
		"sortBy=password",
		"status=BAD",
	]) {
		assert.equal((await get("alice", `?${query}`)).status, 400, query);
	}
	assert.equal(reads, before);
});
