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
import { formatMinor, parseDecimalToMinor } from "../src/app/utils/money";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const CANCELLED_ID = "22222222-2222-4222-8222-222222222222";
const KEY = "idem-key-0000000001";

test("money: exact two-decimal parsing with bounds", () => {
	assert.equal(parseDecimalToMinor("150.50"), 15050);
	assert.equal(parseDecimalToMinor(150.5), 15050);
	assert.equal(parseDecimalToMinor("10"), 1000);
	assert.equal(parseDecimalToMinor("500000"), 50_000_000);
	for (const bad of [
		"9.99",
		"500000.01",
		"0",
		"-5",
		"abc",
		"1e3",
		"150.555",
		0.1 + 0.2,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		null,
		"",
		" ",
	]) {
		assert.equal(parseDecimalToMinor(bad), null, String(bad));
	}
	assert.equal(formatMinor(15050), "150.50");
	assert.equal(formatMinor(1000), "10.00");
});

test("bKash initiation: persisted first, idempotent, validated, no mock success", async (t) => {
	// --- in-memory data layer -------------------------------------------------
	const users = {
		rec: {
			id: "rec",
			role: "RECIPIENT",
			status: "ACTIVE",
			isDeleted: false,
			phone: "01711111111",
		},
		rec2: {
			id: "rec2",
			role: "RECIPIENT",
			status: "ACTIVE",
			isDeleted: false,
			phone: null,
		},
		admin: {
			id: "admin",
			role: "ADMIN",
			status: "ACTIVE",
			isDeleted: false,
			phone: null,
		},
		donor: {
			id: "donor",
			role: "DONOR",
			status: "ACTIVE",
			isDeleted: false,
			phone: null,
		},
	};
	t.mock.method(jwtUtils, "verifyToken", (token) => ({
		success: Boolean(users[token]),
		data: { userId: token, role: users[token]?.role },
	}));
	const requests = {
		[REQUEST_ID]: { id: REQUEST_ID, status: "OPEN", isDeleted: false },
		[CANCELLED_ID]: { id: CANCELLED_ID, status: "CANCELLED", isDeleted: false },
	};
	const payments = [];
	const audits = [];
	const original = {
		userFind: prisma.user.findUnique,
		reqFind: prisma.bloodRequest.findUnique,
		payFindUnique: prisma.payment.findUnique,
		payFindFirst: prisma.payment.findFirst,
		payCreate: prisma.payment.create,
		payUpdate: prisma.payment.update,
		auditCreate: prisma.auditLog.create,
	};
	t.after(() => {
		prisma.user.findUnique = original.userFind;
		prisma.bloodRequest.findUnique = original.reqFind;
		prisma.payment.findUnique = original.payFindUnique;
		prisma.payment.findFirst = original.payFindFirst;
		prisma.payment.create = original.payCreate;
		prisma.payment.update = original.payUpdate;
		prisma.auditLog.create = original.auditCreate;
		cache.close();
		return prisma.$disconnect();
	});
	prisma.user.findUnique = async ({ where }) => users[where.id];
	prisma.bloodRequest.findUnique = async ({ where }) => {
		const found = requests[where.id];
		return found && found.isDeleted === where.isDeleted ? found : null;
	};
	prisma.payment.findUnique = async ({ where }) => {
		await new Promise((resolve) => setImmediate(resolve));
		const key = where.payerId_idempotencyKey;
		return (
			payments.find(
				(p) =>
					p.payerId === key.payerId && p.idempotencyKey === key.idempotencyKey,
			) ?? null
		);
	};
	prisma.payment.findFirst = async ({ where, omit }) => {
		const ids = where.OR.map((c) => c.id ?? c.paymentId);
		const found = payments.find(
			(p) => ids.includes(p.id) || ids.includes(p.paymentId),
		);
		if (!found) return null;
		const copy = {
			...found,
			request: { id: found.requestId },
			payer: { id: found.payerId },
		};
		for (const field of Object.keys(omit ?? {})) delete copy[field];
		return copy;
	};
	prisma.payment.create = async ({ data }) => {
		await new Promise((resolve) => setImmediate(resolve));
		const clash = payments.some(
			(p) =>
				(p.payerId === data.payerId &&
					p.idempotencyKey === data.idempotencyKey) ||
				p.paymentId === data.paymentId ||
				p.merchantInvoiceNumber === data.merchantInvoiceNumber,
		);
		if (clash)
			throw Object.assign(new Error("Unique constraint failed"), {
				code: "P2002",
			});
		const row = {
			id: `pay-${payments.length + 1}`,
			transactionId: null,
			checkoutUrl: null,
			failureReason: null,
			paymentExecuteResponse: null,
			createdAt: new Date(),
			...data,
		};
		payments.push(row);
		return { ...row };
	};
	prisma.payment.update = async ({ where, data }) => {
		const row = payments.find((p) => p.id === where.id);
		Object.assign(row, data);
		return { ...row };
	};
	prisma.auditLog.create = async ({ data }) => {
		audits.push(data);
		return data;
	};

	// --- stand-in bKash gateway ----------------------------------------------
	const gateway = { mode: "ok", calls: [], pendingAtCreate: null };
	const stub = http.createServer((req, res) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk;
		});
		req.on("end", () => {
			const json = body ? JSON.parse(body) : {};
			gateway.calls.push({ path: req.url, body: json, headers: req.headers });
			const send = (status, payload) => {
				res.writeHead(status, { "content-type": "application/json" });
				res.end(
					typeof payload === "string" ? payload : JSON.stringify(payload),
				);
			};
			if (req.url.endsWith("/token/grant")) {
				return send(200, {
					statusCode: "0000",
					id_token: "tok-1",
					expires_in: 3600,
				});
			}
			if (req.url.endsWith("/checkout/create")) {
				gateway.pendingAtCreate = payments
					.filter((p) => p.merchantInvoiceNumber === json.merchantInvoiceNumber)
					.map((p) => ({ status: p.status, paymentId: p.paymentId }));
				const base = {
					statusCode: "0000",
					paymentID: `TR${gateway.calls.length}`,
					bkashURL: `${gateway.url}/redirect?paymentID=TR${gateway.calls.length}`,
					amount: json.amount,
					currency: "BDT",
					merchantInvoiceNumber: json.merchantInvoiceNumber,
				};
				if (gateway.mode === "declined")
					return send(200, { statusCode: "2001", statusMessage: "Invalid" });
				if (gateway.mode === "incomplete")
					return send(200, { statusCode: "0000" });
				if (gateway.mode === "nonjson") return send(200, "<html>oops</html>");
				if (gateway.mode === "http500") return send(500, { error: "x" });
				if (gateway.mode === "untrusted")
					return send(200, {
						...base,
						bkashURL: "https://evil.example.com/pay",
					});
				return send(200, base);
			}
			send(404, {});
		});
	});
	await new Promise((resolve) => stub.listen(0, "127.0.0.1", resolve));
	t.after(() => new Promise((resolve) => stub.close(resolve)));
	gateway.url = `http://127.0.0.1:${stub.address().port}`;

	const savedConfig = { ...config };
	t.after(() => Object.assign(config, savedConfig));
	const configure = () =>
		Object.assign(config, {
			bkash_app_key: "key",
			bkash_app_secret: "secret",
			bkash_username: "user",
			bkash_password: "pass",
			bkash_base_url: `${gateway.url}/tokenized-v`,
			bkash_callback_url:
				"http://localhost:5000/api/v1/payments/bkash/callback",
		});
	// Strip path prefix so the stub sees /token/grant etc. regardless of base path.
	configure();

	const app = express();
	app.use(express.json());
	app.use(cookieParser());
	app.use("/payments", PaymentRoutes);
	app.use(globalErrorHandler);
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const base = `http://127.0.0.1:${server.address().port}/payments`;
	const init = (token, body, key = KEY) =>
		fetch(`${base}/bkash/create`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				...(token ? { authorization: `Bearer ${token}` } : {}),
				...(key ? { "idempotency-key": key } : {}),
			},
			body: JSON.stringify(body),
		});
	const valid = { requestId: REQUEST_ID, amount: "150.50" };
	const reset = () => {
		payments.length = 0;
		audits.length = 0;
		gateway.calls.length = 0;
		gateway.mode = "ok";
	};

	// --- access + validation -------------------------------------------------
	assert.equal((await init(null, valid)).status, 401);
	assert.equal((await init("donor", valid)).status, 403);
	for (const bad of [
		{ ...valid, amount: "9.99" },
		{ ...valid, amount: 0.1 + 0.2 },
		{ ...valid, amount: "150.555" },
		{ ...valid, amount: -5 },
		{ ...valid, amount: "abc" },
		{ ...valid, amount: "500000.01" },
		{ ...valid, amount: undefined },
		{ ...valid, requestId: "not-a-uuid" },
		{ ...valid, payerId: "someone-else" },
		{ ...valid, status: "COMPLETED" },
	]) {
		assert.equal((await init("rec", bad)).status, 400, JSON.stringify(bad));
	}
	assert.equal((await init("rec", valid, null)).status, 400, "key required");
	assert.equal(
		(await init("rec", valid, "short")).status,
		400,
		"key too short",
	);
	assert.equal(
		(await init("rec", valid, "bad key with spaces!!")).status,
		400,
		"key charset",
	);
	assert.equal(payments.length, 0, "nothing stored for rejected input");
	assert.equal(gateway.calls.length, 0, "gateway untouched for rejected input");

	// --- missing request / cancelled request / unconfigured --------------------
	assert.equal(
		(
			await init("rec", {
				...valid,
				requestId: "33333333-3333-4333-8333-333333333333",
			})
		).status,
		404,
	);
	assert.equal(
		(await init("rec", { ...valid, requestId: CANCELLED_ID })).status,
		400,
	);
	Object.assign(config, { bkash_app_key: "" });
	let res = await init("rec", valid);
	assert.equal(res.status, 503);
	assert.match((await res.json()).message, /unavailable/i);
	assert.equal(payments.length, 0, "unconfigured stores nothing");
	assert.equal(gateway.calls.length, 0);
	configure();

	// --- happy path: stored PENDING before the gateway call ------------------------
	res = await init("rec", valid);
	assert.equal(res.status, 201);
	assert.equal(res.headers.get("cache-control"), "no-store");
	let body = await res.json();
	assert.match(body.data.bkashURL, /\/redirect\?paymentID=TR/);
	assert.equal(body.data.payment.amount, "150.50");
	assert.equal(body.data.payment.currency, "BDT");
	assert.equal(body.data.payment.status, "PENDING");
	assert.equal(body.data.payment.paymentMethod, "BKASH");
	for (const hidden of [
		"idempotencyKey",
		"initiationFingerprint",
		"checkoutUrl",
		"payerId",
		"payer",
	]) {
		assert.equal(hidden in body.data.payment, false, hidden);
	}
	assert.equal(payments.length, 1);
	assert.equal(payments[0].payerId, "rec", "payer comes from the session");
	assert.equal(payments[0].amountMinor, 15050);
	assert.equal(payments[0].amount, 150.5);
	assert.equal(payments[0].paymentId, body.data.payment.paymentId);
	assert.deepEqual(
		gateway.pendingAtCreate?.map((p) => p.status),
		["PENDING"],
		"attempt stored before the gateway call",
	);
	assert.match(gateway.pendingAtCreate[0].paymentId, /^PENDING-/);
	const create = gateway.calls.find((c) => c.path.endsWith("/checkout/create"));
	assert.equal(create.body.amount, "150.50");
	assert.equal(create.body.currency, "BDT");
	assert.equal(create.body.payerReference, "01711111111");
	assert.equal(create.body.callbackURL, config.bkash_callback_url);
	assert.equal(
		audits.filter((a) => a.action === "PAYMENT_INITIATED").length,
		1,
	);

	// --- replay: same key + same body -> same attempt, no second gateway call -------
	const callsBefore = gateway.calls.length;
	res = await init("rec", { requestId: REQUEST_ID, amount: 150.5 });
	assert.equal(res.status, 200);
	const replay = await res.json();
	assert.equal(replay.data.bkashURL, body.data.bkashURL);
	assert.equal(replay.data.payment.id, body.data.payment.id);
	assert.equal(gateway.calls.length, callsBefore);
	assert.equal(payments.length, 1);

	// same key with a different amount or request -> 422, nothing created
	assert.equal((await init("rec", { ...valid, amount: "151.00" })).status, 422);
	assert.equal(
		(await init("rec", { requestId: CANCELLED_ID, amount: "150.50" })).status,
		422,
	);
	assert.equal(payments.length, 1);
	// another payer using the same key is independent
	assert.equal((await init("rec2", valid)).status, 201);
	assert.equal(payments.length, 2);
	assert.equal(
		(await init("admin", valid, "idem-key-admin-00001")).status,
		201,
		"admin may contribute",
	);

	// --- concurrent duplicates -> exactly one attempt and one gateway create ------
	reset();
	const results = await Promise.all([
		init("rec", valid),
		init("rec", valid),
		init("rec", valid),
	]);
	assert.deepEqual(results.map((r) => r.status).sort(), [200, 200, 201]);
	assert.equal(payments.length, 1);
	assert.equal(
		gateway.calls.filter((c) => c.path.endsWith("/checkout/create")).length,
		1,
	);

	// --- gateway failures never produce a URL or a mock success ---------------
	for (const mode of [
		"declined",
		"incomplete",
		"nonjson",
		"http500",
		"untrusted",
	]) {
		reset();
		gateway.mode = mode;
		res = await init("rec", valid, `idem-fail-${mode}-0000`);
		assert.equal(res.status, 502, mode);
		const failure = await res.json();
		assert.equal(failure.success, false);
		assert.doesNotMatch(
			JSON.stringify(failure),
			/redirect|evil|bkashURL/i,
			mode,
		);
		assert.equal(payments.length, 1, mode);
		assert.equal(payments[0].status, "FAILED", mode);
		assert.ok(payments[0].failureReason, mode);
		assert.match(payments[0].paymentId, /^PENDING-/, "no gateway id adopted");
		assert.equal(
			audits.filter((a) => a.action === "PAYMENT_FAILED").length,
			1,
			mode,
		);
		// Replay of the failed attempt shows FAILED with no URL; a new key retries.
		gateway.mode = "ok";
		const again = await (
			await init("rec", valid, `idem-fail-${mode}-0000`)
		).json();
		assert.equal(again.data.payment.status, "FAILED");
		assert.equal(again.data.bkashURL, null);
		assert.equal(
			(await init("rec", valid, `idem-retry-${mode}-0000`)).status,
			201,
		);
	}
	reset();
	await new Promise((resolve) => stub.close(resolve));
	res = await init("rec", valid, "idem-unreachable-0001");
	assert.equal(res.status, 502, "unreachable gateway");
	assert.equal(payments[0].status, "FAILED");

	// --- detail read: payer/admin only, internals omitted, legacy rows readable ----
	payments.push({
		id: "legacy-1",
		requestId: REQUEST_ID,
		payerId: "rec",
		amount: 99.99,
		amountMinor: 9999,
		currency: "BDT",
		paymentMethod: "BKASH",
		paymentId: "BKASH_LEGACY",
		transactionId: "TRX1",
		status: "COMPLETED",
		idempotencyKey: null,
		initiationFingerprint: null,
		checkoutUrl: null,
		createdAt: new Date(),
	});
	const detail = (token, id) =>
		fetch(`${base}/${id}`, { headers: { authorization: `Bearer ${token}` } });
	res = await detail("rec", "legacy-1");
	assert.equal(res.status, 200);
	const legacy = (await res.json()).data;
	assert.equal(legacy.paymentId, "BKASH_LEGACY");
	assert.equal(legacy.transactionId, "TRX1");
	assert.equal(legacy.amount, 99.99);
	for (const hidden of [
		"idempotencyKey",
		"initiationFingerprint",
		"checkoutUrl",
	]) {
		assert.equal(hidden in legacy, false, hidden);
	}
	assert.equal((await detail("admin", "BKASH_LEGACY")).status, 200);
	assert.equal((await detail("rec2", "legacy-1")).status, 403);
	assert.equal((await detail("donor", "legacy-1")).status, 403);
});
