import assert from "node:assert/strict";
import { test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { prisma } from "../src/app/lib/prisma";
import { cache } from "../src/app/lib/redis";
import { globalErrorHandler } from "../src/app/middleware/globalErrorHandler";
import { AdminRoutes } from "../src/app/module/admin/admin.route";
import { BloodRequestRoutes } from "../src/app/module/bloodRequest/bloodRequest.route";
import { DonationRoutes } from "../src/app/module/donation/donation.route";
import { jwtUtils } from "../src/app/utils/jwt";

// Blocking happens through the admin endpoint; the donor's existing token must then be refused
// on every protected route, and work again after unblocking. Authorization is evaluated before
// validation, so a 400 means "allowed in, bad input" and a 403 means "refused".
test("moderation: blocking takes effect immediately for an existing session and is audited", async (t) => {
	t.after(async () => {
		cache.close();
		await prisma.$disconnect();
	});
	const users = {
		admin: { id: "admin", email: "admin@example.test", role: "ADMIN", status: "ACTIVE", isDeleted: false },
		donor: { id: "donor", email: "donor@example.test", role: "DONOR", status: "ACTIVE", isDeleted: false },
	};
	const audit = [];
	t.mock.method(jwtUtils, "verifyToken", (token) => ({
		success: Boolean(users[token]),
		data: { userId: token, role: users[token]?.role },
	}));
	const original = {
		find: prisma.user.findUnique,
		update: prisma.user.update,
		log: prisma.auditLog.create,
	};
	t.after(() => {
		prisma.user.findUnique = original.find;
		prisma.user.update = original.update;
		prisma.auditLog.create = original.log;
	});
	prisma.user.findUnique = async ({ where }) => users[where.id];
	prisma.user.update = async ({ where, data }) => {
		Object.assign(users[where.id], data);
		return { ...users[where.id], donorProfile: null };
	};
	prisma.auditLog.create = async ({ data }) => {
		audit.push(data);
		return data;
	};

	const app = express();
	app.use(express.json());
	app.use(cookieParser());
	app.use("/admin", AdminRoutes);
	app.use("/donations", DonationRoutes);
	app.use("/blood-requests", BloodRequestRoutes);
	app.use(globalErrorHandler);
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const base = `http://127.0.0.1:${server.address().port}`;
	const call = (method, path, token, body) =>
		fetch(base + path, {
			method,
			headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
			body: body ? JSON.stringify(body) : undefined,
		});
	const protectedCalls = () => [
		["GET", "/donations/my-history?page=0"],
		["PATCH", "/donations/any/status", { status: "COMPLETED", notes: "x".repeat(501) }],
		["POST", "/blood-requests/any/accept", { notes: "x".repeat(501) }],
	];

	// Before: the donor is let in (validation rejects the deliberately bad input).
	for (const [method, path, body] of protectedCalls()) {
		assert.equal((await call(method, path, "donor", body)).status, 400, `${method} ${path} before block`);
	}

	// Moderation input is validated and the admin cannot block themselves.
	assert.equal((await call("PATCH", "/admin/users/donor/status", "admin", { status: "DELETED" })).status, 400);
	assert.equal(
		(await call("PATCH", "/admin/users/donor/status", "admin", { status: "BLOCKED", reason: "x".repeat(501) })).status,
		400,
	);
	assert.equal((await call("PATCH", "/admin/users/donor/status", "donor", { status: "BLOCKED" })).status, 403);
	assert.equal((await call("PATCH", "/admin/users/admin/status", "admin", { status: "BLOCKED" })).status, 400);
	assert.equal(users.admin.status, "ACTIVE");
	assert.equal(audit.length, 0, "rejected moderation writes no audit entry");

	// Block: same token, same request, now refused everywhere.
	const blocked = await call("PATCH", "/admin/users/donor/status", "admin", { status: "BLOCKED", reason: "Repeated no-shows" });
	assert.equal(blocked.status, 200);
	assert.equal(users.donor.status, "BLOCKED");
	assert.equal(audit.length, 1);
	assert.deepEqual(
		{ userId: audit[0].userId, action: audit[0].action, resource: audit[0].resource, resourceId: audit[0].resourceId },
		{ userId: "admin", action: "USER_BLOCKED", resource: "User", resourceId: "donor" },
	);
	assert.equal(audit[0].details.reason, "Repeated no-shows");
	assert.equal(audit[0].details.previousStatus, "ACTIVE");
	assert.equal(audit[0].details.newStatus, "BLOCKED");
	for (const [method, path, body] of protectedCalls()) {
		assert.equal((await call(method, path, "donor", body)).status, 403, `${method} ${path} after block`);
	}

	// Unblock: access returns and a second audit entry is written with the default reason.
	assert.equal((await call("PATCH", "/admin/users/donor/status", "admin", { status: "ACTIVE" })).status, 200);
	assert.equal(audit.at(-1).action, "USER_ACTIVATED");
	assert.equal(audit.at(-1).details.reason, "Administrative moderation action");
	for (const [method, path, body] of protectedCalls()) {
		assert.equal((await call(method, path, "donor", body)).status, 400, `${method} ${path} after unblock`);
	}
});
