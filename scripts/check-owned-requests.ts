import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import config from "../src/app/config/index";
import { prisma } from "../src/app/lib/prisma";

// Local read-only integration check. Uses short-lived signed test tokens for
// existing accounts; it does not test password login, create users or seed data.
const base = process.env.OWNED_TEST_API_URL || "http://localhost:13034/api/v1";
try {
	const users = await prisma.user.findMany({
		where: { role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		select: { id: true },
		orderBy: { createdAt: "asc" },
		take: 2,
	});
	assert.equal(
		users.length,
		2,
		"Requires two existing active recipients; no data is created automatically",
	);
	for (const user of users) {
		const token = jwt.sign({ userId: user.id }, config.jwt_access_secret, {
			expiresIn: "5m",
		});
		const get = (query = "") =>
			fetch(`${base}/blood-requests/mine${query}`, {
				headers: { authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(15000),
			});
		const response = await get(
			"?limit=1&page=1&sortBy=createdAt&sortOrder=desc",
		);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "private, no-store");
		const { data } = await response.json();
		const where = { requesterId: user.id, isDeleted: false };
		const expected = await prisma.bloodRequest.findMany({
			where,
			orderBy: [{ createdAt: "desc" }, { id: "asc" }],
			select: { id: true, status: true },
		});
		assert.equal(data.meta.total, expected.length);
		assert.deepEqual(
			data.result.map((row: { id: string }) => row.id),
			expected.slice(0, 1).map((row) => row.id),
		);
		assert.equal(data.summary.total, expected.length);
		for (const status of ["OPEN", "MATCHED", "FULFILLED", "CANCELLED"]) {
			assert.equal(
				data.summary[status.toLowerCase()],
				expected.filter((row) => row.status === status).length,
			);
		}
		const filteredResponse = await get("?status=OPEN&limit=1&page=2");
		assert.equal(filteredResponse.status, 200);
		const filtered = (await filteredResponse.json()).data;
		assert.equal(
			filtered.meta.total,
			expected.filter((row) => row.status === "OPEN").length,
		);
		assert.deepEqual(filtered.summary, data.summary);
		assert.deepEqual(
			filtered.result.map((row: { id: string }) => row.id),
			expected
				.filter((row) => row.status === "OPEN")
				.slice(1, 2)
				.map((row) => row.id),
		);
		assert.equal(
			(
				await get(
					`?requesterId=${users.find((other) => other.id !== user.id)!.id}`,
				)
			).status,
			400,
		);
		console.log(
			`Recipient ${users.indexOf(user) + 1}: owner isolation, page data, summary and tampering checks passed (${expected.length} owned records).`,
		);
	}
	assert.equal(
		(
			await fetch(`${base}/blood-requests/mine`, {
				signal: AbortSignal.timeout(15000),
			})
		).status,
		401,
	);
	console.log("Anonymous denial passed. No users or requests modified.");
} finally {
	await prisma.$disconnect();
}
