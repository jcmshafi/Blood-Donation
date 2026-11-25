import assert from "node:assert/strict";
import { test } from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { prisma } from "../src/app/lib/prisma";
import { cache } from "../src/app/lib/redis";
import { globalErrorHandler } from "../src/app/middleware/globalErrorHandler";
import { AdminRoutes } from "../src/app/module/admin/admin.route";
import { jwtUtils } from "../src/app/utils/jwt";

test("admin lists: allow-listed sorting, bounded pagination, strict queries, admin only", async (t) => {
	t.after(async () => {
		cache.close();
		await prisma.$disconnect();
	});
	const users = {
		admin: { id: "admin", role: "ADMIN", status: "ACTIVE", isDeleted: false },
		donor: { id: "donor", role: "DONOR", status: "ACTIVE", isDeleted: false },
		rec: { id: "rec", role: "RECIPIENT", status: "ACTIVE", isDeleted: false },
		blocked: { id: "blocked", role: "ADMIN", status: "BLOCKED", isDeleted: false },
	};
	t.mock.method(jwtUtils, "verifyToken", (token) => ({
		success: Boolean(users[token]),
		data: { userId: token, role: users[token]?.role },
	}));
	const originalFind = prisma.user.findUnique;
	prisma.user.findUnique = async ({ where }) => users[where.id];
	t.after(() => {
		prisma.user.findUnique = originalFind;
	});

	const dataset = Array.from({ length: 25 }, (_, i) => ({ id: `u${String(i + 1).padStart(2, "0")}` }));
	const calls = { users: [], logs: [] };
	const original = {
		userCount: prisma.user.count,
		userFind: prisma.user.findMany,
		logCount: prisma.auditLog.count,
		logFind: prisma.auditLog.findMany,
	};
	t.after(() => {
		prisma.user.count = original.userCount;
		prisma.user.findMany = original.userFind;
		prisma.auditLog.count = original.logCount;
		prisma.auditLog.findMany = original.logFind;
	});
	prisma.user.count = async () => dataset.length;
	prisma.user.findMany = async (args) => {
		calls.users.push(args);
		return dataset.slice(args.skip, args.skip + args.take);
	};
	prisma.auditLog.count = async () => dataset.length;
	prisma.auditLog.findMany = async (args) => {
		calls.logs.push(args);
		return dataset.slice(args.skip, args.skip + args.take);
	};

	const app = express();
	app.use(express.json());
	app.use(cookieParser());
	app.use("/admin", AdminRoutes);
	app.use(globalErrorHandler);
	const server = app.listen(0, "127.0.0.1");
	await new Promise((resolve) => server.once("listening", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const base = `http://127.0.0.1:${server.address().port}/admin`;
	const get = (path, token, query = "") =>
		fetch(`${base}${path}${query}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });

	for (const path of ["/users", "/audit-logs"]) {
		for (const [token, status] of [[null, 401], ["bogus", 401], ["donor", 403], ["rec", 403], ["blocked", 403]]) {
			assert.equal((await get(path, token)).status, status, `${path} ${token}`);
		}
	}
	assert.equal(calls.users.length + calls.logs.length, 0, "unauthorized callers never reach the database");

	const invalid = [
		"?page=0", "?page=abc", "?page=1.5", "?page=-1", "?page=1&page=2",
		"?limit=0", "?limit=101", "?limit=1e2", "?limit=999999",
		"?sortBy=password", "?sortBy=donorProfile", "?sortBy=donorProfile.bloodGroup",
		"?sortBy=id", "?sortBy=__proto__", "?sortBy=createdAt&sortBy=name",
		"?sortOrder=up", "?sortOrder=ASC", "?isDeleted=true", "?foo=bar",
		"?searchTerm=", "?searchTerm=" + "x".repeat(101),
	];
	for (const q of invalid) {
		assert.equal((await get("/users", "admin", q)).status, 400, `users ${q}`);
		assert.equal((await get("/audit-logs", "admin", q.replace("searchTerm", "action"))).status, 400, `logs ${q}`);
	}
	for (const q of ["?role=OWNER", "?status=DELETED", "?role=DONOR&role=ADMIN"]) {
		assert.equal((await get("/users", "admin", q)).status, 400, q);
	}
	for (const q of ["?searchTerm=a", "?role=ADMIN"]) {
		assert.equal((await get("/audit-logs", "admin", q)).status, 400, `audit rejects ${q}`);
	}
	assert.equal(calls.users.length + calls.logs.length, 0, "invalid queries are rejected before querying");

	// Defaults: compatible response shape, bounded page size, stable tie-breaker.
	const res = await get("/users", "admin");
	assert.equal(res.status, 200);
	assert.equal(res.headers.get("cache-control"), "private, no-store");
	const body = await res.json();
	assert.deepEqual(body.data.meta, { page: 1, limit: 10, total: 25, totalPages: 3 });
	assert.equal(body.data.result.length, 10);
	assert.deepEqual(calls.users.at(-1).orderBy, [{ createdAt: "desc" }, { id: "asc" }]);
	assert.equal(calls.users.at(-1).skip, 0);
	assert.equal(calls.users.at(-1).take, 10);

	const page3 = await (await get("/users", "admin", "?page=3&limit=10")).json();
	assert.deepEqual(page3.data.meta, { page: 3, limit: 10, total: 25, totalPages: 3 });
	assert.equal(page3.data.result.length, 5);
	assert.equal(calls.users.at(-1).skip, 20);
	const max = await get("/users", "admin", "?limit=100");
	assert.equal(max.status, 200);
	assert.equal(calls.users.at(-1).take, 100);

	// Every allowed sort field and the filters reach Prisma as typed values only.
	for (const field of ["createdAt", "updatedAt", "name", "email", "role", "status"]) {
		assert.equal((await get("/users", "admin", `?sortBy=${field}&sortOrder=asc`)).status, 200);
		assert.deepEqual(calls.users.at(-1).orderBy, [{ [field]: "asc" }, { id: "asc" }]);
	}
	assert.equal((await get("/users", "admin", "?role=DONOR&status=BLOCKED&searchTerm=%20ann%20")).status, 200);
	const where = calls.users.at(-1).where;
	assert.deepEqual(where.AND[0], { isDeleted: false });
	assert.deepEqual(where.AND.slice(2), [{ role: "DONOR" }, { status: "BLOCKED" }]);
	assert.equal(where.AND[1].OR[0].name.contains, "ann", "search is trimmed");
	assert.equal(calls.users.at(-1).omit.password, true, "password hash is never selected");

	// Audit logs: same rules, own allow-list, default page size 20.
	const logs = await (await get("/audit-logs", "admin")).json();
	assert.deepEqual(logs.data.meta, { page: 1, limit: 20, total: 25, totalPages: 2 });
	assert.deepEqual(calls.logs.at(-1).orderBy, [{ createdAt: "desc" }, { id: "asc" }]);
	for (const field of ["createdAt", "action", "resource"]) {
		assert.equal((await get("/audit-logs", "admin", `?sortBy=${field}`)).status, 200);
		assert.deepEqual(calls.logs.at(-1).orderBy[0], { [field]: "desc" });
	}
	for (const field of ["name", "email", "userId", "details", "ipAddress"]) {
		assert.equal((await get("/audit-logs", "admin", `?sortBy=${field}`)).status, 400, field);
	}
	assert.equal((await get("/audit-logs", "admin", "?action=USER_BLOCKED&resource=User&limit=100")).status, 200);
	assert.deepEqual(calls.logs.at(-1).where, {
		AND: [
			{ action: { contains: "USER_BLOCKED", mode: "insensitive" } },
			{ resource: { contains: "User", mode: "insensitive" } },
		],
	});
	assert.equal((await get("/audit-logs", "admin", "?limit=101")).status, 400);
});
