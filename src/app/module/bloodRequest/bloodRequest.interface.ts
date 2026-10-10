import type {
	BloodGroup,
	RequestStatus,
	UrgencyLevel,
} from "../../../generated/prisma/enums";

export interface ICreateBloodRequestPayload {
	patientName: string;
	bloodGroup: BloodGroup;
	unitsNeeded?: number;
	hospitalName: string;
	hospitalAddress: string;
	latitude: number;
	longitude: number;
	contactNumber: string;
	urgency?: UrgencyLevel;
	notes?: string;
}

export interface IUpdateBloodRequestPayload {
	patientName?: string;
	bloodGroup?: BloodGroup;
	unitsNeeded?: number;
	hospitalName?: string;
	hospitalAddress?: string;
	latitude?: number;
	longitude?: number;
	contactNumber?: string;
	urgency?: UrgencyLevel;
	status?: RequestStatus;
	notes?: string;
}

export interface IBloodRequestFilterOptions {
	searchTerm?: string;
	bloodGroup?: BloodGroup;
	urgency?: UrgencyLevel;
	status?: RequestStatus;
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}
