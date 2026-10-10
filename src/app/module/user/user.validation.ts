import { z } from "zod";
import { BloodGroup } from "../../../generated/prisma/enums";

const updateProfileValidationSchema = z.object({
	body: z.object({
		name: z.string().min(2, "Name must be at least 2 characters").optional(),
		phone: z.string().optional(),
		address: z.string().optional(),
	}),
});

const updateDonorProfileValidationSchema = z.object({
	body: z.object({
		bloodGroup: z.nativeEnum(BloodGroup, {
			error: "Invalid blood group",
		}).optional(),
		isAvailable: z.boolean().optional(),
		lastDonationDate: z
			.string()
			.refine((val) => !Number.isNaN(Date.parse(val)), {
				message: "Invalid date format for lastDonationDate (e.g. YYYY-MM-DD or ISO string)",
			})
			.optional()
			.nullable(),
		phone: z.string().optional(),
		address: z.string().optional(),
		latitude: z
			.number()
			.min(-90, "Latitude must be >= -90")
			.max(90, "Latitude must be <= 90")
			.optional(),
		longitude: z
			.number()
			.min(-180, "Longitude must be >= -180")
			.max(180, "Longitude must be <= 180")
			.optional(),
	}),
});

export const UserValidation = {
	updateProfileValidationSchema,
	updateDonorProfileValidationSchema,
};
