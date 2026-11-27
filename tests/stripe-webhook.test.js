import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import http from "node:http";
import { test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import config from "../src/app/config/index";
import { prisma } from "../src/app/lib/prisma";
import { cache } from "../src/app/lib/redis";
import { globalErrorHandler } from "../src/app/middleware/globalErrorHandler";
import {
	PaymentRoutes,
	stripeWebhookBodyParser,
} from "../src/app/module/payment/payment.route";
import { jwtUtils } from "../src/app/utils/jwt";

const SECRET = "whsec_testsecret123";

const sign = (
	payload,
	secret = SECRET,
	timestamp = Math.floor(Date.now() / 1000),
) =>
	`t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")}`;

test("Stripe webhook: signature-verified, idempotent, verified completion, reconcile and cancel", async (t) => {
	const users = {
		rec: { id: "rec", role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		rec2: { id: "rec2", role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		admin: { id: "admin", role: "ADMIN", status: "ACTIVE", isDeleted: false },
	};
	t.mock.method(jwtUtils, "verifyToken", (token) => ({
		success: Boolean(users[token]),
		data: { userId: token, role: users[token]?.role },
	}));
	const payments = [];
	const audits = [];
	const events = new Map();
	const original = {
		userFind: prisma.user.findUnique,
		payFindUnique: prisma.payment.findUnique,
		payFindFirst: prisma.payment.findFirst,
		payUpdateMany: prisma.payment.updateMany,
		auditCreate: prisma.auditLog.create,
		evFind: prisma.paymentWebhookEvent.findUnique,
		evCreate: prisma.paymentWebhookEvent.create,
	};
	t.after(() => {
		prisma.user.findUnique = original.userFind;
		prisma.payment.findUnique = original.payFindUnique;
		prisma.payment.findFirst = original.payFindFirst;
		prisma.payment.updateMany = original.payUpdateMany;
		prisma.auditLog.create = original.auditCreate;
		prisma.paymentWebhookEvent.findUnique = original.evFind;
		prisma.paymentWebhookEvent.create = original.evCreate;
		cache.close();
		return prisma.$disconnect();
	});
	const pick = (where) =>
		payments.find(
			(p) =>
				(where.id !== undefined && p.id === where.id) ||
				(where.paymentId !== undefined && p.paymentId === where.paymentId),
		);
	prisma.user.findUnique = async ({ where }) => users[where.id];
	prisma.payment.findUnique = async ({ where }) => {
		await new Promise((resolve) => setImmediate(resolve));
		const row = pick(where);
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
	prisma.paymentWebhookEvent.findUnique = async ({ where }) =>
		events.get(where.id) ?? null;
	prisma.paymentWebhookEvent.create = async ({ data }) => {
		if (events.has(data.id))
			throw Object.assign(new Error("dup"), { code: "P2002" });
		events.set(data.id, data);
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
			paymentMethod: "STRIPE",
			paymentId: `cs_test_${n}`,
			transactionId: null,
			status: "PENDING",
			failureReason: null,
			paymentExecuteResponse: null,
			idempotencyKey: "secret-key",
			initiationFingerprint: "fp",
			checkoutUrl: "https://checkout.stripe.com/x",
			createdAt: new Date(),
			...overrides,
		};
		payments.push(row);
		return row;
	};

	// --- stand-in Stripe API for retrieve / expire ------------------------------------
	const stripeApi = { sessions: new Map(), calls: [], outage: false };
	const stub = http.createServer((req, res) => {
		stripeApi.calls.push(`${req.method} ${req.url}`);
		req.resume();
		req.on("end", () => {
			const send = (status, payload) => {
				res.writeHead(status, { "content-type": "application/json" });
				res.end(JSON.stringify(payload));
			};
			if (stripeApi.outage)
				return send(500, { error: { type: "api_error", message: "down" } });
			const match = req.url.match(
				/^\/v1\/checkout\/sessions\/([^/?]+)(\/expire)?/,
			);
			const session = match && stripeApi.sessions.get(match[1]);
			if (!session)
				return send(404, {
					error: { type: "invalid_request_error", message: "No such session" },
				});
			if (match[2]) {
				if (session.status === "open") session.status = "expired";
				return send(200, session);
			}
			send(200, session);
		});
	});
	await new Promise((resolve) => stub.listen(0, "127.0.0.1", resolve));
	t.after(() => new Promise((resolve) => stub.close(resolve)));
	const savedConfig = { ...config };
	t.after(() => Object.assign(config, savedConfig));
	Object.assign(config, {
		stripe_secret_key: "sk_test_abc123",
		stripe_webhook_secret: SECRET,
		stripe_currency: "bdt",
		stripe_api_base_url: `http://127.0.0.1:${stub.address().port}`,
		frontend_url: "http://localhost:3000",
	});
	const sessionFor = (row, overrides = {}) => ({
		id: row.paymentId,
		object: "checkout.session",
		status: "complete",
		payment_status: "paid",
		amount_total: row.amountMinor,
		currency: row.currency.toLowerCase(),
		payment_intent: `pi_${row.id}`,
		client_reference_id: row.id,
		...overrides,
	});

	const app = express();
	app.use("/payments/stripe/webhook", stripeWebhookBodyParser);
	app.use(express.json());
	app.use(cookieParser());
	app.use("/payments", PaymentRoutes);
	app.use(globalErrorHandler);
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const base = `http://127.0.0.1:${server.address().port}/payments`;

	let eventCounter = 0;
	const makeEvent = (type, session, id = `evt_${++eventCounter}`) => ({
		id,
		object: "event",
		type,
		data: { object: session },
	});
	const deliver = (
		event,
		{ signature, secret, timestamp, contentType = "application/json" } = {},
	) => {
		const payload = typeof event === "string" ? event : JSON.stringify(event);
		const headers = { "content-type": contentType };
		const sig =
			signature === undefined ? sign(payload, secret, timestamp) : signature;
		if (sig) headers["stripe-signature"] = sig;
		return fetch(`${base}/stripe/webhook`, {
			method: "POST",
			headers,
			body: payload,
		});
	};
	const reset = () => {
		payments.length = 0;
		audits.length = 0;
		events.clear();
		stripeApi.sessions.clear();
		stripeApi.calls.length = 0;
		stripeApi.outage = false;
	};
	const audit = (action) => audits.filter((a) => a.action === action).length;

	// --- signature checks: nothing changes ----------------------------------------------
	reset();
	let row = seed();
	const paid = makeEvent("checkout.session.completed", sessionFor(row));
	assert.equal(
		(await deliver(paid, { signature: "" })).status,
		400,
		"missing signature",
	);
	assert.equal(
		(await deliver(paid, { secret: "whsec_wrongsecret" })).status,
		400,
		"wrong secret",
	);
	assert.equal(
		(await deliver(paid, { signature: "garbage" })).status,
		400,
		"garbage signature",
	);
	const body = JSON.stringify(paid);
	assert.equal(
		(await deliver(body.replace("15050", "1"), { signature: sign(body) }))
			.status,
		400,
		"tampered payload",
	);
	assert.equal(
		(await deliver(paid, { timestamp: Math.floor(Date.now() / 1000) - 3600 }))
			.status,
		400,
		"stale timestamp",
	);
	assert.equal(
		(await deliver(body, { contentType: "text/plain" })).status,
		400,
		"non-JSON content type",
	);
	assert.equal(row.status, "PENDING");
	assert.equal(audits.length, 0);
	assert.equal(events.size, 0);
	config.stripe_webhook_secret = "";
	assert.equal(
		(await deliver(paid)).status,
		503,
		"webhook secret not configured",
	);
	config.stripe_webhook_secret = SECRET;
	assert.equal(row.status, "PENDING");

	// --- verified completion, once ------------------------------------------------------
	let res = await deliver(paid);
	assert.equal(res.status, 200);
	assert.deepEqual(await res.json(), { received: true });
	assert.equal(row.status, "COMPLETED");
	assert.equal(row.transactionId, "pi_pay-1");
	assert.equal(row.paymentExecuteResponse.amountTotal, 15050);
	assert.equal(audit("PAYMENT_COMPLETED"), 1);
	assert.ok(events.has(paid.id));

	// replay of the same event and a second delivery of the same fact: no new effect
	assert.equal((await deliver(paid)).status, 200);
	assert.equal(
		(await deliver(makeEvent("checkout.session.completed", sessionFor(row))))
			.status,
		200,
	);
	assert.equal(audit("PAYMENT_COMPLETED"), 1);

	// later expired/failed events cannot overwrite COMPLETED
	for (const type of [
		"checkout.session.expired",
		"checkout.session.async_payment_failed",
	]) {
		assert.equal(
			(
				await deliver(
					makeEvent(
						type,
						sessionFor(row, { status: "expired", payment_status: "unpaid" }),
					),
				)
			).status,
			200,
		);
		assert.equal(row.status, "COMPLETED", type);
	}
	assert.equal(audits.length, 1);

	// --- concurrent deliveries complete exactly once ------------------------------------
	reset();
	row = seed();
	const burst = await Promise.all(
		[1, 2, 3].map(() =>
			deliver(makeEvent("checkout.session.completed", sessionFor(row))),
		),
	);
	assert.ok(burst.every((r) => r.status === 200));
	assert.equal(row.status, "COMPLETED");
	assert.equal(
		audit("PAYMENT_COMPLETED"),
		1,
		"one audit effect despite concurrent deliveries",
	);

	// --- mismatches never complete --------------------------------------------------------
	for (const [label, overrides] of [
		["amount", { amount_total: 100 }],
		["currency", { currency: "usd" }],
		["missing amount", { amount_total: null }],
	]) {
		reset();
		row = seed();
		await deliver(
			makeEvent("checkout.session.completed", sessionFor(row, overrides)),
		);
		assert.equal(row.status, "FAILED", label);
		assert.equal(row.transactionId, null, label);
		assert.equal(audit("PAYMENT_COMPLETED"), 0, label);
		assert.equal(audit("PAYMENT_VERIFICATION_FAILED"), 1, label);
	}

	// a session that is not this payment's session changes nothing
	reset();
	row = seed();
	assert.equal(
		(
			await deliver(
				makeEvent(
					"checkout.session.completed",
					sessionFor(row, { id: "cs_test_OTHER" }),
				),
			)
		).status,
		200,
	);
	assert.equal(row.status, "PENDING");
	assert.equal(audits.length, 0);

	// unpaid (async method) waits for the success event
	reset();
	row = seed();
	await deliver(
		makeEvent(
			"checkout.session.completed",
			sessionFor(row, { payment_status: "unpaid" }),
		),
	);
	assert.equal(row.status, "PENDING");
	await deliver(
		makeEvent("checkout.session.async_payment_succeeded", sessionFor(row)),
	);
	assert.equal(row.status, "COMPLETED");
	reset();
	row = seed();
	await deliver(
		makeEvent(
			"checkout.session.async_payment_failed",
			sessionFor(row, { payment_status: "unpaid" }),
		),
	);
	assert.equal(row.status, "FAILED");
	assert.equal(audit("PAYMENT_FAILED"), 1);

	// expired checkout
	reset();
	row = seed();
	await deliver(
		makeEvent(
			"checkout.session.expired",
			sessionFor(row, { status: "expired", payment_status: "unpaid" }),
		),
	);
	assert.equal(row.status, "FAILED");
	assert.equal(row.failureReason, "Checkout session expired");

	// webhook arriving before the session id was stored on the attempt
	reset();
	row = seed({ paymentId: "PENDING-abc" });
	await deliver(
		makeEvent(
			"checkout.session.completed",
			sessionFor(row, { id: "cs_test_early" }),
		),
	);
	assert.equal(row.status, "COMPLETED");
	assert.equal(row.paymentId, "cs_test_early");

	// unknown sessions and unhandled event types are acknowledged and ignored
	reset();
	row = seed();
	assert.equal(
		(
			await deliver(
				makeEvent("checkout.session.completed", {
					id: "cs_test_nobody",
					payment_status: "paid",
				}),
			)
		).status,
		200,
	);
	assert.equal(
		(await deliver(makeEvent("customer.created", { id: "cus_1" }))).status,
		200,
	);
	assert.equal(row.status, "PENDING");
	assert.equal(audits.length, 0);

	// --- reconcile on read (missed webhook) -----------------------------------------------
	const get = (token, id) =>
		fetch(`${base}/${id}`, { headers: { authorization: `Bearer ${token}` } });
	reset();
	row = seed();
	stripeApi.sessions.set(row.paymentId, sessionFor(row));
	res = await get("rec", "pay-1");
	assert.equal(res.status, 200);
	let detail = (await res.json()).data;
	assert.equal(detail.status, "COMPLETED");
	assert.equal(detail.transactionId, "pi_pay-1");
	for (const hidden of [
		"paymentExecuteResponse",
		"idempotencyKey",
		"initiationFingerprint",
		"checkoutUrl",
	]) {
		assert.equal(hidden in detail, false, hidden);
	}
	assert.equal(audit("PAYMENT_COMPLETED"), 1);
	const callsAfter = stripeApi.calls.length;
	await get("rec", "pay-1");
	assert.equal(
		stripeApi.calls.length,
		callsAfter,
		"settled payments are not re-checked",
	);

	reset();
	row = seed();
	stripeApi.sessions.set(
		row.paymentId,
		sessionFor(row, { status: "open", payment_status: "unpaid" }),
	);
	detail = (await (await get("rec", "pay-1")).json()).data;
	assert.equal(detail.status, "PENDING", "an open checkout stays pending");

	stripeApi.sessions.set(
		row.paymentId,
		sessionFor(row, { status: "expired", payment_status: "unpaid" }),
	);
	detail = (await (await get("rec", "pay-1")).json()).data;
	assert.equal(detail.status, "FAILED");

	reset();
	row = seed();
	stripeApi.sessions.set(row.paymentId, sessionFor(row, { amount_total: 1 }));
	detail = (await (await get("rec", "pay-1")).json()).data;
	assert.equal(
		detail.status,
		"FAILED",
		"mismatch on reconcile never completes",
	);
	assert.equal(audit("PAYMENT_COMPLETED"), 0);

	reset();
	row = seed();
	stripeApi.outage = true;
	res = await get("rec", "pay-1");
	assert.equal(res.status, 200, "Stripe outage does not break reads");
	assert.equal((await res.json()).data.status, "PENDING");

	// legacy bKash rows are never sent to Stripe
	reset();
	row = seed({ paymentMethod: "BKASH", paymentId: "BKASH_1" });
	assert.equal((await get("rec", "pay-1")).status, 200);
	assert.equal(stripeApi.calls.length, 0);

	// --- cancel: only after Stripe confirms the session is unpaid ---------------------------
	const cancel = (token, id) =>
		fetch(`${base}/${id}/cancel`, {
			method: "POST",
			headers: { authorization: `Bearer ${token}` },
		});
	reset();
	row = seed();
	stripeApi.sessions.set(
		row.paymentId,
		sessionFor(row, { status: "open", payment_status: "unpaid" }),
	);
	assert.equal(
		(await fetch(`${base}/pay-1/cancel`, { method: "POST" })).status,
		401,
	);
	assert.equal(
		(await cancel("rec2", "pay-1")).status,
		403,
		"another payer cannot cancel",
	);
	assert.equal(row.status, "PENDING");
	assert.equal(stripeApi.calls.length, 0);
	res = await cancel("rec", "pay-1");
	assert.equal(res.status, 200);
	let result = (await res.json()).data;
	assert.equal(result.outcome, "cancelled");
	assert.equal(row.status, "CANCELLED");
	assert.ok(
		stripeApi.calls.some((c) => c.includes("/expire")),
		"the open session was expired at Stripe",
	);
	assert.equal(audit("PAYMENT_CANCELLED"), 1);
	assert.equal(stripeApi.sessions.get(row.paymentId).status, "expired");
	assert.equal((await cancel("rec", "pay-1")).status, 200, "repeat is a no-op");
	assert.equal(audit("PAYMENT_CANCELLED"), 1);
	// a cancelled payment cannot be completed by a late webhook
	await deliver(makeEvent("checkout.session.completed", sessionFor(row)));
	assert.equal(row.status, "CANCELLED");

	// paid sessions are completed, never cancelled
	reset();
	row = seed();
	stripeApi.sessions.set(row.paymentId, sessionFor(row));
	result = (await (await cancel("rec", "pay-1")).json()).data;
	assert.equal(result.outcome, "completed");
	assert.equal(row.status, "COMPLETED");
	assert.ok(!stripeApi.calls.some((c) => c.includes("/expire")));

	// outage: nothing is cancelled, caller gets 502
	reset();
	row = seed();
	stripeApi.outage = true;
	assert.equal((await cancel("rec", "pay-1")).status, 502);
	assert.equal(row.status, "PENDING");
	assert.equal(audits.length, 0);

	// unknown payment, admin may cancel, settled payments are untouched
	assert.equal((await cancel("rec", "nope")).status, 404);
	reset();
	row = seed({ status: "COMPLETED", transactionId: "pi_x" });
	result = (await (await cancel("admin", "pay-1")).json()).data;
	assert.equal(result.outcome, "completed");
	assert.equal(stripeApi.calls.length, 0);
});
