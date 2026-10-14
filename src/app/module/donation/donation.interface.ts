import type {
	BloodGroup,
	DonationStatus,
	RequestStatus,
	UrgencyLevel,
} from "../../../generated/prisma/enums";

export interface IAcceptBloodRequestPayload {
	notes?: string;
}

export interface IUpdateDonationStatusPayload {
	status: DonationStatus;
	notes?: string;
}

export interface IMatchingDonorsQuery {
	maxDistanceKm?: number;
}

export interface IMatchingDonorItem {
	donorProfileId: string;
	donorUserId: string;
	name: string;
	email: string;
	phone: string | null;
	bloodGroup: BloodGroup | null;
	address: string | null;
	latitude: number | null;
	longitude: number | null;
	distanceKm: number | null;
	isAvailable: boolean;
	lastDonationDate: Date | null;
	totalDonations: number;
	daysSinceLastDonation: number | null;
}

export interface IMatchingDonorsResponse {
	bloodRequest: {
		id: string;
		patientName: string;
		bloodGroup: BloodGroup;
		unitsNeeded: number;
		unitsFulfilled: number;
		hospitalName: string;
		hospitalAddress: string;
		urgency: UrgencyLevel;
		status: RequestStatus;
	};
	compatibleBloodGroups: BloodGroup[];
	totalMatchingDonors: number;
	donors: IMatchingDonorItem[];
}
