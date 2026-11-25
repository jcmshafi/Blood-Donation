import { z } from "zod";
import { Role, UserStatus } from "../../../generated/prisma/enums";

const positiveInteger = (maximum: number, fallback: number) =>
	z
		.string()
		.regex(/^[1-9]\d*$/)
		.transform(Number)
		.pipe(z.number().int().min(1).max(maximum))
		.default(fallback);

const text = (maximum: number) => z.string().trim().min(1).max(maximum);

// Allow-lists: the only fields a caller can sort by. Anything else (password,
// relations, unknown columns) is rejected before a query is built.
export const ADMIN_USER_SORT_FIELDS = [
	"createdAt",
	"updatedAt",
	"name",
	"email",
	"role",
	"status",
] as const;
export const AUDIT_LOG_SORT_FIELDS = [
	"createdAt",
	"action",
	"resource",
] as const;

// Parsed straight from req.query: unknown keys, repeated values and invalid
// values are rejected (400) before any database access.
export const adminUsersQuerySchema = z
	.object({
		page: positiveInteger(1000000, 1),
		limit: positiveInteger(100, 10),
		role: z.nativeEnum(Role).optional(),
		status: z.nativeEnum(UserStatus).optional(),
		searchTerm: text(100).optional(),
		sortBy: z.enum(ADMIN_USER_SORT_FIELDS).default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
	})
	.strict();

export const auditLogsQuerySchema = z
	.object({
		page: positiveInteger(1000000, 1),
		limit: positiveInteger(100, 20),
		action: text(100).optional(),
		resource: text(100).optional(),
		sortBy: z.enum(AUDIT_LOG_SORT_FIELDS).default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
	})
	.strict();

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
