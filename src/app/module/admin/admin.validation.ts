import { z } from "zod";
import { Role, UserStatus } from "../../../generated/prisma/enums";

const updateUserStatusValidationSchema = z.object({
	body: z.object({
		status: z.nativeEnum(UserStatus, {
			error: "Status must be either ACTIVE or BLOCKED",
		}),
		reason: z
			.string()
			.max(500, "Reason must not exceed 500 characters")
			.optional(),
	}),
});

const userFilterValidationSchema = z.object({
	query: z
		.object({
			page: z.string().optional(),
			limit: z.string().optional(),
			role: z.nativeEnum(Role).optional(),
			status: z.nativeEnum(UserStatus).optional(),
			searchTerm: z.string().optional(),
			sortBy: z.string().optional(),
			sortOrder: z.enum(["asc", "desc"]).optional(),
		})
		.optional(),
});

const auditLogFilterValidationSchema = z.object({
	query: z
		.object({
			page: z.string().optional(),
			limit: z.string().optional(),
			action: z.string().optional(),
			resource: z.string().optional(),
			sortBy: z.string().optional(),
			sortOrder: z.enum(["asc", "desc"]).optional(),
		})
		.optional(),
});

export const AdminValidation = {
	updateUserStatusValidationSchema,
	userFilterValidationSchema,
	auditLogFilterValidationSchema,
};
