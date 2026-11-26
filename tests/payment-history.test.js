import assert from "node:assert/strict";
import { test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { prisma } from "../src/app/lib/prisma";
import { cache } from "../src/app/lib/redis";
import { globalErrorHandler } from "../src/app/middleware/globalErrorHandler";
import { PaymentRoutes } from "../src/app/module/payment/payment.route";
import { jwtUtils } from "../src/app/utils/jwt";

test("payment history: payer-derived scope, strict query, bounded pages, no cross-payer reads", async (t) => {
	const users = {
		rec: { id: "rec", role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		rec2: { id: "rec2", role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		admin: { id: "admin", role: "ADMIN", status: "ACTIVE", isDeleted: false },
		donor: { id: "donor", role: "DONOR", status: "ACTIVE", isDeleted: false },
	};
	t.mock.method(jwtUtils, "verifyToken", (token) => ({
		success: Boolean(users[token]),
		data: { userId: token, role: users[token]?.role },
	}));

	const statuses = ["COMPLETED", "PENDING", "FAILED", "CANCELLED"];
	const rows = [];
	for (let i = 1; i <= 25; i++) {
		rows.push(
			row(`r${String(i).padStart(2, "0")}`, "rec", i, statuses[i % 4], i),
		);
	}
	rows.push(
		row("legacy", "rec", 0, "COMPLETED", 0, {
			paymentId: "BKASH_LEGACY",
			amountMinor: 9999,
		}),
	);
	rows.push(row("other1", "rec2", 1, "COMPLETED", 100));
	rows.push(row("admin1", "admin", 1, "PENDING", 101));
	function row(id, payerId, n, status, day, extra = {}) {
		return {
			id,
			requestId: "req-1",
			payerId,
			status,
			paymentMethod: "BKASH",
			currency: "BDT",
			amountMinor: 1000 + n * 100,
			paymentId: `P-${id}`,
			transactionId: status === "COMPLETED" ? `TRX-${id}` : null,
			failureReason: null,
			createdAt: new Date(Date.UTC(2026, 0, 1 + day)),
			request: {
				id: "req-1",
				bloodGroup: "A_POSITIVE",
				hospitalName: "City Hospital",
			},
			...extra,
		};
	}

	const original = {
		userFind: prisma.user.findUnique,
		count: prisma.payment.count,
		findMany: prisma.payment.findMany,
		findFirst: prisma.payment.findFirst,
	};
	t.after(() => {
		prisma.user.findUnique = original.userFind;
		prisma.payment.count = original.count;
		prisma.payment.findMany = original.findMany;
		prisma.payment.findFirst = original.findFirst;
		cache.close();
		return prisma.$disconnect();
	});
	const queries = [];
	const matches = (where) =>
		rows.filter(
			(r) =>
				r.payerId === where.payerId &&
				(!where.status || r.status === where.status),
		);
	prisma.user.findUnique = async ({ where }) => users[where.id];
	prisma.payment.count = async ({ where }) => matches(where).length;
	prisma.payment.findMany = async (args) => {
		queries.push(args);
		const [{ ...primary }] = args.orderBy;
		const [field, direction] = Object.entries(primary)[0];
		const sorted = matches(args.where).sort((a, b) => {
			const result = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
			return (
				(direction === "asc" ? result : -result) || a.id.localeCompare(b.id)
			);
		});
		return sorted.slice(args.skip, args.skip + args.take);
	};
	prisma.payment.findFirst = async ({ where }) => {
		const ids = where.OR.map((c) => c.id ?? c.paymentId);
		const found = rows.find(
			(r) => ids.includes(r.id) || ids.includes(r.paymentId),
		);
		return found ? { ...found, payer: { id: found.payerId } } : null;
	};

	const app = express();
	app.use(express.json());
	app.use(cookieParser());
	app.use("/payments", PaymentRoutes);
	app.use(globalErrorHandler);
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const base = `http://127.0.0.1:${server.address().port}/payments`;
	const mine = (token, query = "") =>
		fetch(`${base}/mine${query}`, {
			headers: token ? { authorization: `Bearer ${token}` } : {},
		});

	// access
	assert.equal((await mine(null)).status, 401);
	assert.equal((await mine("bogus")).status, 401);
	assert.equal((await mine("donor")).status, 403);

	// defaults: own rows only, newest first, summary shape, no internals
	let res = await mine("rec");
	assert.equal(res.status, 200);
	assert.equal(res.headers.get("cache-control"), "private, no-store");
	let data = (await res.json()).data;
	assert.deepEqual(data.meta, { page: 1, limit: 10, total: 26, totalPages: 3 });
	assert.equal(data.result.length, 10);
	assert.ok(
		data.result.every((r) => !["other1", "admin1"].includes(r.id)),
		"never another payer's rows",
	);
	assert.equal(data.result[0].id, "r25", "newest first");
	assert.deepEqual(Object.keys(data.result[0]).sort(), [
		"amount",
		"createdAt",
		"currency",
		"failureReason",
		"id",
		"paymentId",
		"paymentMethod",
		"request",
		"requestId",
		"status",
		"transactionId",
	]);
	assert.equal(data.result[0].amount, "35.00");
	assert.equal(queries.at(-1).where.payerId, "rec");

	// pages, last page, beyond last page
	data = (await (await mine("rec", "?page=3")).json()).data;
	assert.equal(data.result.length, 6);
	data = (await (await mine("rec", "?page=9")).json()).data;
	assert.equal(data.result.length, 0);
	assert.equal(data.meta.total, 26);

	// status filter and sort allow-list
	data = (await (await mine("rec", "?status=COMPLETED&limit=50")).json()).data;
	assert.ok(
		data.result.length > 0 &&
			data.result.every((r) => r.status === "COMPLETED"),
	);
	assert.equal(data.meta.total, data.result.length);
	data = (
		await (
			await mine("rec", "?sortBy=amountMinor&sortOrder=asc&limit=50")
		).json()
	).data;
	assert.equal(data.result[0].id, "r01", "lowest amount first");
	assert.deepEqual(queries.at(-1).orderBy, [
		{ amountMinor: "asc" },
		{ id: "asc" },
	]);
	assert.equal(
		data.result.find((r) => r.id === "legacy").amount,
		"99.99",
		"legacy bKash row stays readable",
	);

	// admins list their own payments only
	data = (await (await mine("admin")).json()).data;
	assert.deepEqual(
		data.result.map((r) => r.id),
		["admin1"],
	);

	// identity tampering and invalid parameters are rejected before any query runs
	const before = queries.length;
	for (const bad of [
		"?payerId=rec2",
		"?userId=rec2",
		"?payer=rec2",
		"?requestId=req-1",
		"?status=REFUNDED",
		"?sortBy=payerId",
		"?sortBy=paymentExecuteResponse",
		"?sortOrder=sideways",
		"?page=0",
		"?page=-1",
		"?page=abc",
		"?limit=0",
		"?limit=51",
		"?limit=1e3",
		"?page=1&page=2",
	]) {
		assert.equal((await mine("rec", bad)).status, 400, bad);
	}
	assert.equal(
		queries.length,
		before,
		"invalid queries never reach the database",
	);

	// "mine" is not treated as a payment id; another payer's detail stays denied
	assert.equal(
		(await fetch(`${base}/mine`, { headers: { authorization: "Bearer rec" } }))
			.status,
		200,
	);
	assert.equal(
		(
			await fetch(`${base}/other1`, {
				headers: { authorization: "Bearer rec" },
			})
		).status,
		403,
	);
	assert.equal(
		(
			await fetch(`${base}/P-other1`, {
				headers: { authorization: "Bearer rec" },
			})
		).status,
		403,
	);
	assert.equal(
		(
			await fetch(`${base}/other1`, {
				headers: { authorization: "Bearer rec2" },
			})
		).status,
		200,
	);
	assert.equal(
		(
			await fetch(`${base}/other1`, {
				headers: { authorization: "Bearer admin" },
			})
		).status,
		200,
	);
});
