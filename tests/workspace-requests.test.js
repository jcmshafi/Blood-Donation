import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "../src/app/lib/prisma";
import { cache } from "../src/app/lib/redis";
import { jwtUtils } from "../src/app/utils/jwt";
import { BloodRequestRoutes } from "../src/app/module/bloodRequest/bloodRequest.route";
import { globalErrorHandler } from "../src/app/middleware/globalErrorHandler";

test("workspace HTTP detail authorizes owner/admin before private reads and excludes credentials", async (t) => {
	t.after(async () => {
		cache.close();
		await prisma.$disconnect();
	});
	const id = "550e8400-e29b-41d4-a716-446655440000";
	const users = {
		owner: { id: "owner", role: "RECIPIENT", status: "ACTIVE" },
		other: { id: "other", role: "RECIPIENT", status: "ACTIVE" },
		admin: { id: "admin", role: "ADMIN", status: "ACTIVE" },
		donor: { id: "donor", role: "DONOR", status: "ACTIVE" },
		blocked: { id: "owner", role: "RECIPIENT", status: "BLOCKED" },
		deleted: {
			id: "owner",
			role: "RECIPIENT",
			status: "ACTIVE",
			isDeleted: true,
		},
	};
	t.mock.method(jwtUtils, "verifyToken", (token) => ({
		success: Boolean(users[token]),
		data: { userId: token, role: "ADMIN" },
	}));
	const originalUser = prisma.user.findUnique;
	const originalRequest = prisma.bloodRequest.findFirst;
	t.after(() => {
		prisma.user.findUnique = originalUser;
		prisma.bloodRequest.findFirst = originalRequest;
	});
	prisma.user.findUnique = async ({ where }) => users[where.id];
	let reads = 0;
	let deleted = false;
	function project(row, select) {
		return Object.fromEntries(
			Object.entries(select).map(([key, choice]) => [
				key,
				choice === true
					? row[key]
					: Array.isArray(row[key])
						? row[key].map((item) => project(item, choice.select))
						: project(row[key], choice.select),
			]),
		);
	}
	prisma.bloodRequest.findFirst = async ({ where, select }) => {
		reads++;
		assert.equal(where.isDeleted, false);
		assert.deepEqual(
			Object.keys(select).sort(),
			[
				"id",
				"patientName",
				"bloodGroup",
				"unitsNeeded",
				"unitsFulfilled",
				"hospitalName",
				"hospitalAddress",
				"urgency",
				"status",
				"createdAt",
				"updatedAt",
				"requesterId",
				"latitude",
				"longitude",
				"contactNumber",
				"notes",
				"assignments",
			].sort(),
		);
		assert.deepEqual(
			Object.keys(select.assignments.select).sort(),
			[
				"id",
				"donorId",
				"status",
				"notes",
				"completedAt",
				"createdAt",
				"updatedAt",
				"donor",
			].sort(),
		);
		assert.deepEqual(select.assignments.select.donor.select, {
			id: true,
			name: true,
			phone: true,
			donorProfile: { select: { bloodGroup: true, phone: true } },
		});
		if (
			deleted ||
			where.id !== id ||
			(where.requesterId && where.requesterId !== "owner")
		)
			return null;
		return project(
			{
				id,
				requesterId: "owner",
				patientName: "Patient",
				contactNumber: "PRIVATE-CONTACT",
				notes: "PRIVATE-NOTES",
				assignments: [
					{
						id: "assignment",
						donorId: "donor",
						status: "ASSIGNED",
						donor: {
							id: "donor",
							name: "Donor",
							phone: "PRIVATE-PHONE",
							password: "SECRET-PASSWORD",
							googleId: "SECRET-GOOGLE",
							donorProfile: {
								bloodGroup: "O_POSITIVE",
								phone: "PROFILE-PHONE",
								address: "SECRET-ADDRESS",
								latitude: 1,
							},
						},
					},
				],
			},
			select,
		);
	};
	t.mock.method(cache, "get", async () => {
		assert.fail("workspace must not read shared cache");
	});
	const app = express();
	app.use(cookieParser());
	app.use("/requests", BloodRequestRoutes);
	app.use(globalErrorHandler);
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const get = (token, requestId = id, query = "") =>
		fetch(
			`http://127.0.0.1:${server.address().port}/requests/${requestId}/workspace${query}`,
			{
				headers: token ? { authorization: `Bearer ${token}` } : {},
			},
		);
	for (const [token, status] of [
		[null, 401],
		["invalid", 401],
		["donor", 403],
		["blocked", 403],
		["deleted", 401],
	])
		assert.equal((await get(token)).status, status);
	assert.equal(reads, 0);
	assert.equal((await get("owner", "not-a-uuid")).status, 400);
	assert.equal((await get("other", id, "?requesterId=owner")).status, 400);
	assert.equal(reads, 0);
	for (const token of ["owner", "admin"]) {
		const response = await get(token);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		const body = await response.text();
		assert(body.includes("PRIVATE-CONTACT"));
		assert(body.includes("PROFILE-PHONE"));
		assert(!body.includes("SECRET-"));
	}
	const denied = await get("other");
	assert.equal(denied.status, 404);
	assert(!(await denied.text()).includes("PRIVATE-"));
	assert.equal(
		(await get("owner", "550e8400-e29b-41d4-a716-446655440009")).status,
		404,
	);
	deleted = true;
	assert.equal((await get("owner")).status, 404);
	assert.equal((await get("admin")).status, 404);
});
