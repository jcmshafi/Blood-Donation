import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import config from "../src/app/config/index";
import { prisma } from "../src/app/lib/prisma";

// Read-only local check; short-lived signed test tokens, not password login.
const base = process.env.OWNED_TEST_API_URL || "http://localhost:13034/api/v1";
try {
	const row = await prisma.bloodRequest.findFirst({
		where: {
			isDeleted: false,
			requester: { role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		},
		select: { id: true, requesterId: true },
	});
	assert(row, "Requires an existing request owned by an active recipient");
	const other = await prisma.user.findFirst({
		where: {
			role: "RECIPIENT",
			status: "ACTIVE",
			isDeleted: false,
			id: { not: row.requesterId },
		},
		select: { id: true },
	});
	const admin = await prisma.user.findFirst({
		where: { role: "ADMIN", status: "ACTIVE", isDeleted: false },
		select: { id: true },
	});
	assert(other && admin, "Requires existing unrelated recipient and admin");
	const get = (userId: string) =>
		fetch(`${base}/blood-requests/${row.id}/matching-donors`, {
			headers: {
				authorization: `Bearer ${jwt.sign({ userId }, config.jwt_access_secret, { expiresIn: "5m" })}`,
			},
			signal: AbortSignal.timeout(15000),
		});
	const owner = await get(row.requesterId);
	assert.equal(owner.status, 200);
	assert.equal(owner.headers.get("cache-control"), "private, no-store");
	const expected = await owner.json();
	assert(Array.isArray(expected.data.donors));
	const denied = await get(other.id);
	assert.equal(denied.status, 404);
	assert.equal((await denied.json()).data, undefined);
	for (const userId of [row.requesterId, admin.id]) {
		const response = await get(userId);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), expected);
	}
	console.log(
		"Owner warm read, unrelated-recipient denial, repeated owner and admin reads passed. No records modified.",
	);
} finally {
	await prisma.$disconnect();
}
