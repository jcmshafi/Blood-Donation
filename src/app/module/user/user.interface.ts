import type { BloodGroup } from "../../../generated/prisma/enums";

export interface IUpdateUserProfilePayload {
	name?: string;
	phone?: string;
	address?: string;
}

export interface IUpdateDonorProfilePayload {
	bloodGroup?: BloodGroup;
	isAvailable?: boolean;
	lastDonationDate?: string | null;
	phone?: string;
	address?: string;
	latitude?: number;
	longitude?: number;
}
