import assert from "node:assert/strict";
import { test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { prisma } from "../src/app/lib/prisma";
import { cache } from "../src/app/lib/redis";
import { globalErrorHandler } from "../src/app/middleware/globalErrorHandler";
import { DonationRoutes } from "../src/app/module/donation/donation.route";
import { jwtUtils } from "../src/app/utils/jwt";

test("donor history: pagination, sort, status filter, owner isolation, page-independent summary", async (t) => {
	t.after(async () => {
		cache.close();
		await prisma.$disconnect();
	});
	const users = {
		d1: { id: "d1", role: "DONOR", status: "ACTIVE", isDeleted: false },
		d2: { id: "d2", role: "DONOR", status: "ACTIVE", isDeleted: false },
		d3: { id: "d3", role: "DONOR", status: "ACTIVE", isDeleted: false },
		rec: { id: "rec", role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		admin: { id: "admin", role: "ADMIN", status: "ACTIVE", isDeleted: false },
		blocked: { id: "blocked", role: "DONOR", status: "BLOCKED", isDeleted: false },
	};
	const day = (n) => new Date(Date.UTC(2026, 0, n));
	const rows = [
		{ id: "x1", donorId: "d1", status: "COMPLETED", createdAt: day(1), completedAt: day(2) },
		{ id: "x2", donorId: "d1", status: "ASSIGNED", createdAt: day(3), completedAt: null },
		{ id: "x3", donorId: "d1", status: "CANCELLED", createdAt: day(5), completedAt: null },
		{ id: "x4", donorId: "d1", status: "COMPLETED", createdAt: day(7), completedAt: day(8) },
		{ id: "y1", donorId: "d2", status: "COMPLETED", createdAt: day(2), completedAt: day(3) },
	];
	const profiles = {
		d1: { userId: "d1", totalDonations: 2, isAvailable: false, lastDonationDate: new Date() },
		d2: { userId: "d2", totalDonations: 1, isAvailable: true, lastDonationDate: null },
	};
	t.mock.method(jwtUtils, "verifyToken", (token) => ({
		success: Boolean(users[token]),
		data: { userId: token, role: users[token]?.role },
	}));
	const originalFind = prisma.user.findUnique;
	prisma.user.findUnique = async ({ where }) => users[where.id];
	t.after(() => {
		prisma.user.findUnique = originalFind;
	});
	const scoped = (where) => {
		assert.ok(users[where.donorId], "every query must be donor scoped");
		return rows.filter(
			(r) => r.donorId === where.donorId && (!where.status || r.status === where.status),
		);
	};
	let reads = 0;
	const originalTransaction = prisma.$transaction;
	t.after(() => {
		prisma.$transaction = originalTransaction;
	});
	prisma.$transaction = async (callback, options) => {
		reads++;
		assert.equal(options.isolationLevel, "RepeatableRead");
		return callback({
			donorProfile: { findUnique: async ({ where }) => profiles[where.userId] ?? null },
			donationAssignment: {
				count: async ({ where }) => scoped(where).length,
				findMany: async ({ where, skip, take, orderBy }) => {
					assert.deepEqual(orderBy[1], { id: "asc" });
					const key = Object.keys(orderBy[0])[0];
					const raw = orderBy[0][key];
					const dir = typeof raw === "string" ? raw : raw.sort;
					const sorted = [...scoped(where)].sort((a, b) => {
						const av = a[key]?.getTime();
						const bv = b[key]?.getTime();
						if (av == null || bv == null) return (av == null) - (bv == null); // nulls last
						return dir === "asc" ? av - bv : bv - av;
					});
					return sorted.slice(skip, skip + take).map((r) => ({ id: r.id, status: r.status }));
				},
				groupBy: async ({ where }) => {
					assert.deepEqual(Object.keys(where), ["donorId"], "summary ignores filters");
					const counts = {};
					for (const r of scoped(where)) counts[r.status] = (counts[r.status] || 0) + 1;
					return Object.entries(counts).map(([status, n]) => ({ status, _count: { _all: n } }));
				},
			},
		});
	};
	const app = express();
	app.use(cookieParser());
	app.use("/donations", DonationRoutes);
	app.use(globalErrorHandler);
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const base = `http://127.0.0.1:${server.address().port}/donations/my-history`;
	const get = (token, query = "") =>
		fetch(base + query, { headers: token ? { authorization: `Bearer ${token}` } : {} });
	const ids = (body) => body.data.donations.map((d) => d.id);

	for (const [token, status] of [[null, 401], ["invalid", 401], ["rec", 403], ["admin", 403], ["blocked", 403]]) {
		assert.equal((await get(token)).status, status);
	}
	assert.equal(reads, 0, "unauthorized callers never reach the database");

	const bad = [
		"?page=0", "?page=abc", "?page=1&page=2", "?limit=101", "?limit=0",
		"?status=OPEN", "?sortBy=donorId", "?sortBy=request.patientName",
		"?sortOrder=up", "?donorId=d2", "?userId=d2", "?foo=bar",
	];
	for (const q of bad) assert.equal((await get("d1", q)).status, 400, q);
	assert.equal(reads, 0, "invalid queries are rejected before querying");

	const res = await get("d1");
	assert.equal(res.status, 200);
	assert.equal(res.headers.get("cache-control"), "private, no-store");
	const first = await res.json();
	assert.deepEqual(first.data.meta, { page: 1, limit: 10, total: 4, totalPages: 1 });
	assert.deepEqual(ids(first), ["x4", "x3", "x2", "x1"], "default createdAt desc");
	assert.deepEqual(
		{
			a: first.data.summary.totalAssigned,
			c: first.data.summary.totalCompleted,
			x: first.data.summary.totalCancelled,
			v: first.data.summary.totalActive,
			t: first.data.summary.totalDonations,
		},
		{ a: 4, c: 2, x: 1, v: 1, t: 2 },
	);
	assert.equal(first.data.summary.isEligibleNow, false);
	assert.ok(first.data.summary.daysUntilEligible > 0);

	const p1 = await (await get("d1", "?limit=2&page=1")).json();
	const p2 = await (await get("d1", "?limit=2&page=2")).json();
	assert.deepEqual(ids(p1), ["x4", "x3"]);
	assert.deepEqual(ids(p2), ["x2", "x1"]);
	assert.equal(p1.data.meta.totalPages, 2);
	assert.deepEqual(p2.data.summary, p1.data.summary, "summary independent of page");

	const asc = await (await get("d1", "?sortOrder=asc")).json();
	assert.deepEqual(ids(asc), ["x1", "x2", "x3", "x4"]);
	const byCompleted = await (await get("d1", "?sortBy=completedAt&sortOrder=desc")).json();
	assert.equal(ids(byCompleted)[0], "x4");

	const completed = await (await get("d1", "?status=COMPLETED&limit=1")).json();
	assert.deepEqual(completed.data.meta, { page: 1, limit: 1, total: 2, totalPages: 2 });
	assert.deepEqual(ids(completed), ["x4"]);
	assert.deepEqual(completed.data.summary, first.data.summary, "summary independent of filter");

	const empty = await (await get("d1", "?page=99")).json();
	assert.deepEqual(empty.data.donations, []);
	assert.equal(empty.data.meta.total, 4);
	assert.deepEqual(empty.data.summary, first.data.summary);

	const other = await (await get("d2")).json();
	assert.deepEqual(ids(other), ["y1"], "owner isolation");
	assert.equal(other.data.summary.isEligibleNow, true);
	const none = await (await get("d3")).json();
	assert.deepEqual(none.data.donations, []);
	assert.deepEqual(none.data.meta, { page: 1, limit: 10, total: 0, totalPages: 0 });
	assert.equal(none.data.summary.totalAssigned, 0);
	assert.equal(none.data.summary.isAvailable, false);
});
