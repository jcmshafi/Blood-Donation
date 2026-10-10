import { z } from "zod";
import {
	BloodGroup,
	RequestStatus,
	UrgencyLevel,
} from "../../../generated/prisma/enums";

const createBloodRequestSchema = z.object({
	body: z.object({
		patientName: z.string().min(2, "Patient name must be at least 2 characters"),
		bloodGroup: z.nativeEnum(BloodGroup, {
			error: "Valid blood group is required",
		}),
		unitsNeeded: z.number().int().min(1, "At least 1 unit is required").default(1),
		hospitalName: z.string().min(2, "Hospital name is required"),
		hospitalAddress: z.string().min(2, "Hospital address is required"),
		latitude: z
			.number()
			.min(-90, "Latitude must be >= -90")
			.max(90, "Latitude must be <= 90"),
		longitude: z
			.number()
			.min(-180, "Longitude must be >= -180")
			.max(180, "Longitude must be <= 180"),
		contactNumber: z.string().min(6, "Valid contact number is required"),
		urgency: z.nativeEnum(UrgencyLevel).optional().default(UrgencyLevel.NORMAL),
		notes: z.string().optional(),
	}),
});

const updateBloodRequestSchema = z.object({
	body: z.object({
		patientName: z.string().min(2).optional(),
		bloodGroup: z.nativeEnum(BloodGroup).optional(),
		unitsNeeded: z.number().int().min(1).optional(),
		hospitalName: z.string().min(2).optional(),
		hospitalAddress: z.string().min(2).optional(),
		latitude: z.number().min(-90).max(90).optional(),
		longitude: z.number().min(-180).max(180).optional(),
		contactNumber: z.string().min(6).optional(),
		urgency: z.nativeEnum(UrgencyLevel).optional(),
		status: z.nativeEnum(RequestStatus).optional(),
		notes: z.string().optional(),
	}),
});

export const BloodRequestValidation = {
	createBloodRequestSchema,
	updateBloodRequestSchema,
};
