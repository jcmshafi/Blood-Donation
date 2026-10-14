import { z } from "zod";
import { DonationStatus } from "../../../generated/prisma/enums";

const matchingDonorsQuerySchema = z.object({
	query: z
		.object({
			maxDistanceKm: z
				.string()
				.optional()
				.transform((val) => (val ? Number(val) : undefined))
				.refine((val) => val === undefined || (!Number.isNaN(val) && val > 0), {
					message: "maxDistanceKm must be a positive number",
				}),
		})
		.optional(),
});

const acceptBloodRequestSchema = z.object({
	body: z.object({
		notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
	}),
});

const updateDonationStatusSchema = z.object({
	body: z.object({
		status: z.enum([DonationStatus.COMPLETED, DonationStatus.CANCELLED]),
		notes: z.string().max(500, "Notes cannot exceed 500 characters").optional(),
	}),
});

export const DonationValidation = {
	matchingDonorsQuerySchema,
	acceptBloodRequestSchema,
	updateDonationStatusSchema,
};
