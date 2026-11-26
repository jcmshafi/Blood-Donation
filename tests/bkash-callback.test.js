import assert from "node:assert/strict";
import http from "node:http";
import { test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import config from "../src/app/config/index";
import { prisma } from "../src/app/lib/prisma";
import { cache } from "../src/app/lib/redis";
import { globalErrorHandler } from "../src/app/middleware/globalErrorHandler";
import { PaymentRoutes } from "../src/app/module/payment/payment.route";
import { jwtUtils } from "../src/app/utils/jwt";

test("bKash callback: gateway-verified, idempotent, never trusts the browser status", async (t) => {
	const users = {
		rec: { id: "rec", role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		other: {
			id: "other",
			role: "RECIPIENT",
			status: "ACTIVE",
			isDeleted: false,
		},
		admin: { id: "admin", role: "ADMIN", status: "ACTIVE", isDeleted: false },
	};
	t.mock.method(jwtUtils, "verifyToken", (token) => ({
		success: Boolean(users[token]),
		data: { userId: token, role: users[token]?.role },
	}));
	const payments = [];
	const audits = [];
	const original = {
		userFind: prisma.user.findUnique,
		payFindUnique: prisma.payment.findUnique,
		payFindFirst: prisma.payment.findFirst,
		payUpdateMany: prisma.payment.updateMany,
		auditCreate: prisma.auditLog.create,
	};
	t.after(() => {
		prisma.user.findUnique = original.userFind;
		prisma.payment.findUnique = original.payFindUnique;
		prisma.payment.findFirst = original.payFindFirst;
		prisma.payment.updateMany = original.payUpdateMany;
		prisma.auditLog.create = original.auditCreate;
		cache.close();
		return prisma.$disconnect();
	});
	prisma.user.findUnique = async ({ where }) => users[where.id];
	prisma.payment.findUnique = async ({ where }) => {
		await new Promise((resolve) => setImmediate(resolve));
		const row = payments.find((p) => p.paymentId === where.paymentId);
		return row
			? { ...row, payer: { id: row.payerId, name: "Payer", email: null } }
			: null;
	};
	prisma.payment.findFirst = async ({ where, omit }) => {
		const ids = where.OR.map((c) => c.id ?? c.paymentId);
		const row = payments.find(
			(p) => ids.includes(p.id) || ids.includes(p.paymentId),
		);
		if (!row) return null;
		const copy = {
			...row,
			request: { id: row.requestId },
			payer: { id: row.payerId },
		};
		for (const field of Object.keys(omit ?? {})) delete copy[field];
		return copy;
	};
	// Conditional update, atomic in JS: this is what makes completion happen once.
	prisma.payment.updateMany = async ({ where, data }) => {
		const row = payments.find(
			(p) => p.id === where.id && p.status === where.status,
		);
		if (!row) return { count: 0 };
		Object.assign(row, data);
		return { count: 1 };
	};
	prisma.auditLog.create = async ({ data }) => {
		audits.push(data);
		return data;
	};
	const seed = (overrides = {}) => {
		const n = payments.length + 1;
		const row = {
			id: `pay-${n}`,
			requestId: "req-1",
			payerId: "rec",
			amount: 150.5,
			amountMinor: 15050,
			currency: "BDT",
			paymentMethod: "BKASH",
			paymentId: `BK${n}`,
			transactionId: null,
			status: "PENDING",
			failureReason: null,
			paymentExecuteResponse: null,
			idempotencyKey: "secret-key",
			initiationFingerprint: "fp",
			checkoutUrl: "https://x",
			createdAt: new Date(),
			...overrides,
		};
		payments.push(row);
		return row;
	};

	// --- stand-in bKash: execute and status responses are scripted per test -------
	const gateway = { calls: [], execute: null, status: null };
	const completed = (row, extra = {}) => ({
		statusCode: "0000",
		paymentID: row.paymentId,
		trxID: `TRX-${row.paymentId}`,
		transactionStatus: "Completed",
		amount: "150.50",
		currency: "BDT",
		...extra,
	});
	const stub = http.createServer((req, res) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk;
		});
		req.on("end", () => {
			const json = body ? JSON.parse(body) : {};
			gateway.calls.push({ path: req.url, paymentID: json.paymentID });
			const send = (status, payload) => {
				res.writeHead(status, { "content-type": "application/json" });
				res.end(JSON.stringify(payload));
			};
			if (req.url.endsWith("/token/grant"))
				return send(200, {
					statusCode: "0000",
					id_token: "tok",
					expires_in: 3600,
				});
			const script = req.url.endsWith("/execute")
				? gateway.execute
				: req.url.endsWith("/payment/status")
					? gateway.status
					: null;
			if (!script) return send(404, {});
			const out = script(json.paymentID);
			if (out === "outage") return send(500, { error: "down" });
			send(200, out);
		});
	});
	await new Promise((resolve) => stub.listen(0, "127.0.0.1", resolve));
	t.after(() => new Promise((resolve) => stub.close(resolve)));
	const savedConfig = { ...config };
	t.after(() => Object.assign(config, savedConfig));
	Object.assign(config, {
		bkash_app_key: "key",
		bkash_app_secret: "secret",
		bkash_username: "user",
		bkash_password: "pass",
		bkash_base_url: `http://127.0.0.1:${stub.address().port}/v`,
		bkash_callback_url: "http://localhost:5000/api/v1/payments/bkash/callback",
		frontend_url: "http://localhost:3000",
	});
	const executeCalls = () =>
		gateway.calls.filter((c) => c.path.endsWith("/execute")).length;
	const statusCalls = () =>
		gateway.calls.filter((c) => c.path.endsWith("/payment/status")).length;
	const reset = () => {
		payments.length = 0;
		audits.length = 0;
		gateway.calls.length = 0;
		gateway.execute = () => ({
			statusCode: "2062",
			statusMessage: "unexpected",
		});
		gateway.status = () => ({
			statusCode: "0000",
			transactionStatus: "Initiated",
		});
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
	const callback = (query) =>
		fetch(`${base}/bkash/callback?${query}`, { redirect: "manual" });
	const location = (res) => res.headers.get("location");
	const audit = (action) => audits.filter((a) => a.action === action).length;

	// --- success: executed, verified, completed once, redirected -------------------
	reset();
	let row = seed();
	gateway.execute = () => completed(row);
	let res = await callback("paymentID=BK1&status=success");
	assert.equal(res.status, 302);
	assert.equal(
		location(res),
		"http://localhost:3000/payment/success?payment=pay-1",
	);
	assert.equal(row.status, "COMPLETED");
	assert.equal(row.transactionId, "TRX-BK1");
	assert.equal(row.paymentExecuteResponse.trxID, "TRX-BK1");
	assert.equal(audit("PAYMENT_COMPLETED"), 1);

	// --- duplicate callbacks: no second execute, no second audit ------------------------
	res = await callback("paymentID=BK1&status=success");
	assert.equal(
		location(res),
		"http://localhost:3000/payment/success?payment=pay-1",
	);
	assert.equal(executeCalls(), 1);
	assert.equal(audit("PAYMENT_COMPLETED"), 1);

	// --- late cancel/failure cannot overwrite COMPLETED, and bKash is not even asked ----
	for (const status of ["cancel", "failure"]) {
		res = await callback(`paymentID=BK1&status=${status}`);
		assert.equal(
			location(res),
			"http://localhost:3000/payment/success?payment=pay-1",
			status,
		);
		assert.equal(row.status, "COMPLETED", status);
	}
	assert.equal(statusCalls(), 0);
	assert.equal(audits.length, 1);

	// --- concurrent callbacks complete exactly once -------------------------------------
	reset();
	row = seed();
	gateway.execute = () => completed(row);
	const burst = await Promise.all(
		[1, 2, 3].map(() => callback("paymentID=BK1&status=success")),
	);
	assert.ok(
		burst.every(
			(r) =>
				location(r) === "http://localhost:3000/payment/success?payment=pay-1",
		),
	);
	assert.equal(row.status, "COMPLETED");
	assert.equal(
		audit("PAYMENT_COMPLETED"),
		1,
		"one audit effect despite concurrent callbacks",
	);

	// --- forged success: bKash does not confirm -> still PENDING, nothing written -------
	reset();
	row = seed();
	res = await callback("paymentID=BK1&status=success");
	assert.equal(res.status, 302);
	assert.equal(row.status, "PENDING");
	assert.equal(row.transactionId, null);
	assert.equal(audits.length, 0);
	assert.equal(
		location(res),
		"http://localhost:3000/payment/success?payment=pay-1",
		"page shows backend pending state",
	);

	// --- mismatches never complete ------------------------------------------------------
	for (const [label, extra] of [
		["amount", { amount: "1.00" }],
		["currency", { currency: "USD" }],
		["payment id", { paymentID: "OTHER" }],
		["status", { transactionStatus: "Initiated" }],
		["amount format", { amount: "150.5.0" }],
	]) {
		reset();
		row = seed();
		gateway.execute = () => completed(row, extra);
		res = await callback("paymentID=BK1&status=success");
		assert.notEqual(row.status, "COMPLETED", label);
		assert.equal(row.transactionId, null, label);
		assert.equal(audit("PAYMENT_COMPLETED"), 0, label);
		assert.equal(audit("PAYMENT_VERIFICATION_FAILED"), 1, label);
		assert.equal(row.status, "FAILED", label);
		assert.match(location(res), /\/payment\/failure\?payment=pay-1$/, label);
	}

	// --- declined execute but bKash says already completed -> verified completion ----------
	reset();
	row = seed();
	gateway.status = () => completed(row);
	res = await callback("paymentID=BK1&status=success");
	assert.equal(row.status, "COMPLETED");
	assert.equal(audit("PAYMENT_COMPLETED"), 1);

	// --- outage: never fake completion; stays PENDING --------------------------------
	reset();
	row = seed();
	gateway.execute = () => "outage";
	gateway.status = () => "outage";
	res = await callback("paymentID=BK1&status=success");
	assert.equal(res.status, 302);
	assert.equal(row.status, "PENDING");
	assert.equal(audits.length, 0);
	res = await callback("paymentID=BK1&status=cancel");
	assert.equal(row.status, "PENDING", "unconfirmed cancel stays pending");
	assert.match(location(res), /\/payment\/cancel\?payment=pay-1$/);

	// --- cancel / failure only after bKash confirms ------------------------------------
	reset();
	row = seed();
	res = await callback("paymentID=BK1&status=cancel"); // bKash still says Initiated
	assert.equal(row.status, "PENDING", "forged cancel cannot cancel");
	assert.equal(audits.length, 0);
	gateway.status = () => ({
		statusCode: "0000",
		transactionStatus: "Cancelled",
	});
	res = await callback("paymentID=BK1&status=cancel");
	assert.equal(row.status, "CANCELLED");
	assert.equal(audit("PAYMENT_CANCELLED"), 1);
	assert.match(location(res), /\/payment\/cancel\?payment=pay-1$/);
	// A cancelled attempt cannot later be completed by a forged success.
	gateway.execute = () => completed(row);
	res = await callback("paymentID=BK1&status=success");
	assert.equal(row.status, "CANCELLED");
	assert.equal(executeCalls(), 0);

	reset();
	row = seed();
	gateway.status = () => ({ statusCode: "0000", transactionStatus: "Failed" });
	res = await callback("paymentID=BK1&status=failure");
	assert.equal(row.status, "FAILED");
	assert.equal(audit("PAYMENT_FAILED"), 1);
	assert.match(location(res), /\/payment\/failure\?payment=pay-1$/);

	// --- legacy rows complete against their backfilled amount -----------------------
	reset();
	row = seed({ amount: 99.99, amountMinor: 9999 });
	gateway.execute = () => completed(row, { amount: "99.99" });
	await callback("paymentID=BK1&status=success");
	assert.equal(row.status, "COMPLETED");

	// --- unknown / missing ids ------------------------------------------------------------
	reset();
	res = await callback("paymentID=NOPE&status=success");
	assert.equal(res.status, 302);
	assert.equal(location(res), "http://localhost:3000/payment/failure");
	assert.equal((await callback("status=success")).status, 400);
	assert.equal((await callback(`paymentID=${"x".repeat(200)}`)).status, 400);
	assert.equal(
		(
			await fetch(`${base}/bkash/callback`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ paymentID: "NOPE" }),
			})
		).status,
		404,
	);

	// --- POST returns a safe JSON summary ---------------------------------------------------
	reset();
	row = seed();
	gateway.execute = () => completed(row);
	res = await fetch(`${base}/bkash/callback`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ paymentID: "BK1", status: "success" }),
	});
	assert.equal(res.status, 200);
	const posted = (await res.json()).data;
	assert.equal(posted.outcome, "completed");
	assert.equal(posted.payment.amount, "150.50");
	assert.equal(posted.payment.transactionId, "TRX-BK1");
	for (const hidden of [
		"paymentExecuteResponse",
		"idempotencyKey",
		"initiationFingerprint",
		"checkoutUrl",
		"payerId",
	]) {
		assert.equal(hidden in posted.payment, false, hidden);
	}

	// --- without a configured frontend the callback answers JSON instead of redirecting ----
	reset();
	row = seed();
	gateway.execute = () => completed(row);
	config.frontend_url = undefined;
	res = await callback("paymentID=BK1&status=success");
	assert.equal(res.status, 200);
	config.frontend_url = "http://localhost:3000";

	// --- detail: payer/admin only, no raw gateway payload or internal fields ------------------
	const detail = (token, id) =>
		fetch(`${base}/${id}`, { headers: { authorization: `Bearer ${token}` } });
	res = await detail("rec", "pay-1");
	assert.equal(res.status, 200);
	const body = (await res.json()).data;
	assert.equal(body.status, "COMPLETED");
	assert.equal(body.transactionId, "TRX-BK1");
	for (const hidden of [
		"paymentExecuteResponse",
		"idempotencyKey",
		"initiationFingerprint",
		"checkoutUrl",
	]) {
		assert.equal(hidden in body, false, hidden);
	}
	assert.equal((await detail("admin", "pay-1")).status, 200);
	assert.equal((await detail("other", "pay-1")).status, 403);
	assert.equal((await fetch(`${base}/pay-1`)).status, 401);
});
