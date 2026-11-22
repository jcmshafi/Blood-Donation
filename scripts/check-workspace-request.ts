import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import config from "../src/app/config/index";
import { prisma } from "../src/app/lib/prisma";

// Local read-only check using short-lived test tokens, not password login.
const base = process.env.OWNED_TEST_API_URL || "http://localhost:13034/api/v1";
try {
	const row = await prisma.bloodRequest.findFirst({
		where: {
			isDeleted: false,
			requester: { role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		},
		select: {
			id: true,
			requesterId: true,
			contactNumber: true,
			latitude: true,
			longitude: true,
			notes: true,
			_count: { select: { assignments: true } },
		},
	});
	assert(row, "Requires an existing request owned by an active recipient");
	const admin = await prisma.user.findFirst({
		where: { role: "ADMIN", status: "ACTIVE", isDeleted: false },
		select: { id: true },
	});
	const other = await prisma.user.findFirst({
		where: {
			role: "RECIPIENT",
			status: "ACTIVE",
			isDeleted: false,
			id: { not: row.requesterId },
		},
		select: { id: true },
	});
	assert(
		admin && other,
		"Requires existing admin and unrelated recipient; no accounts are created",
	);
	const get = (userId?: string, query = "") =>
		fetch(`${base}/blood-requests/${row.id}/workspace${query}`, {
			headers: userId
				? {
						authorization: `Bearer ${jwt.sign({ userId }, config.jwt_access_secret, { expiresIn: "5m" })}`,
					}
				: {},
			signal: AbortSignal.timeout(15000),
		});
	for (const userId of [row.requesterId, admin.id]) {
		const response = await get(userId);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		const { data } = await response.json();
		for (const field of [
			"id",
			"requesterId",
			"contactNumber",
			"latitude",
			"longitude",
			"notes",
		] as const)
			assert.equal(data[field], row[field]);
		assert.equal(data.assignments.length, row._count.assignments);
		for (const assignment of data.assignments) {
			assert.deepEqual(
				Object.keys(assignment.donor).sort(),
				["id", "name", "phone", "donorProfile"].sort(),
			);
			if (assignment.donor.donorProfile)
				assert.deepEqual(Object.keys(assignment.donor.donorProfile).sort(), [
					"bloodGroup",
					"phone",
				]);
		}
	}
	assert.equal((await get(other.id)).status, 404);
	assert.equal(
		(await get(other.id, `?requesterId=${row.requesterId}`)).status,
		400,
	);
	assert.equal((await get()).status, 401);
	const publicResponse = await fetch(`${base}/blood-requests/${row.id}`, {
		signal: AbortSignal.timeout(15000),
	});
	assert.equal(publicResponse.status, 200);
	const publicData = (await publicResponse.json()).data;
	for (const field of [
		"contactNumber",
		"notes",
		"latitude",
		"longitude",
		"requesterId",
		"assignments",
	])
		assert(!(field in publicData));
	console.log(
		`Live owner/admin fields and ${row._count.assignments} assignments verified; unrelated recipient, forged owner and anonymous denied; public detail remains safe. No records modified.`,
	);
} finally {
	await prisma.$disconnect();
}
