import assert from "node:assert/strict";
import { test } from "node:test";
import express from "express";
import cookieParser from "cookie-parser";
import { prisma } from "../src/app/lib/prisma";
import { cache } from "../src/app/lib/redis";
import { jwtUtils } from "../src/app/utils/jwt";
import { BloodRequestRoutes } from "../src/app/module/bloodRequest/bloodRequest.route";
import { globalErrorHandler } from "../src/app/middleware/globalErrorHandler";

test("matching denies unrelated recipients before cold/warm cache and rechecks current ownership", async (t) => {
	t.after(async () => {
		cache.close();
		await prisma.$disconnect();
	});
	const id = "550e8400-e29b-41d4-a716-446655440000";
	const users = Object.fromEntries(
		["owner", "other", "admin", "donor", "blocked"].map((name) => [
			name,
			{
				id: name,
				role:
					name === "admin" ? "ADMIN" : name === "donor" ? "DONOR" : "RECIPIENT",
				status: name === "blocked" ? "BLOCKED" : "ACTIVE",
			},
		]),
	);
	t.mock.method(jwtUtils, "verifyToken", (token) => ({
		success: Boolean(users[token]),
		data: { userId: token, role: "ADMIN" },
	}));
	const originals = [
		prisma.user.findUnique,
		prisma.bloodRequest.findUnique,
		prisma.donorProfile.findMany,
	];
	t.after(() => {
		[
			prisma.user.findUnique,
			prisma.bloodRequest.findUnique,
			prisma.donorProfile.findMany,
		] = originals;
	});
	prisma.user.findUnique = async ({ where }) => users[where.id];
	let owner = "owner",
		deleted = false,
		requestReads = 0,
		donorReads = 0,
		cacheReads = 0;
	prisma.bloodRequest.findUnique = async ({ where }) => {
		requestReads++;
		assert.equal(where.isDeleted, false);
		return deleted || where.id !== id
			? null
			: {
					id,
					requesterId: owner,
					bloodGroup: "O_POSITIVE",
					latitude: 23,
					longitude: 90,
				};
	};
	prisma.donorProfile.findMany = async () => {
		donorReads++;
		return [
			{
				id: "profile",
				userId: "donor",
				bloodGroup: "O_POSITIVE",
				isAvailable: true,
				lastDonationDate: null,
				latitude: 23,
				longitude: 90,
				phone: "PRIVATE-PHONE",
				user: { name: "Donor", email: "PRIVATE-EMAIL" },
			},
		];
	};
	const stored = new Map();
	t.mock.method(cache, "get", async (key) => {
		cacheReads++;
		return stored.get(key);
	});
	t.mock.method(cache, "set", async (key, value) => {
		stored.set(key, value);
	});
	const app = express();
	app.use(cookieParser());
	app.use("/requests", BloodRequestRoutes);
	app.use(globalErrorHandler);
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const get = (token, requestId = id) =>
		fetch(
			`http://127.0.0.1:${server.address().port}/requests/${requestId}/matching-donors`,
			{
				headers: token ? { authorization: `Bearer ${token}` } : {},
			},
		);
	for (const [token, status] of [
		[null, 401],
		["bad", 401],
		["donor", 403],
		["blocked", 403],
	])
		assert.equal((await get(token)).status, status);
	assert.equal(requestReads, 0);
	assert.equal((await get("owner", "invalid")).status, 400);
	assert.equal((await get("other")).status, 404);
	assert.equal(cacheReads, 0);
	assert.equal(donorReads, 0);
	const cold = await get("owner");
	assert.equal(cold.status, 200);
	assert.equal(cold.headers.get("cache-control"), "private, no-store");
	const expected = await cold.json();
	assert.equal(expected.data.donors[0].phone, "PRIVATE-PHONE");
	assert.equal(stored.size, 1);
	const before = cacheReads;
	const denied = await get("other");
	assert.equal(denied.status, 404);
	assert(!(await denied.text()).includes("PRIVATE-"));
	assert.equal(cacheReads, before);
	assert.equal(donorReads, 1);
	for (const token of ["owner", "admin"]) {
		const response = await get(token);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), expected);
	}
	assert.equal(donorReads, 1, "authorized warm calls use cache");
	owner = "other";
	const warmReads = cacheReads;
	assert.equal((await get("owner")).status, 404);
	deleted = true;
	assert.equal((await get("other")).status, 404);
	assert.equal((await get("admin")).status, 404);
	assert.equal(
		cacheReads,
		warmReads,
		"ownership changes/deletion checked before stale cache",
	);
});
