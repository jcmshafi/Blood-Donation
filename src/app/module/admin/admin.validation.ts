import { z } from "zod";
import { UserStatus } from "../../../generated/prisma/enums";

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

export const AdminValidation = {
	updateUserStatusValidationSchema,
};
