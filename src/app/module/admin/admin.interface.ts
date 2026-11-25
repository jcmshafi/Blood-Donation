import type { UserStatus } from "../../../generated/prisma/enums";

export interface IUpdateUserStatusPayload {
	status: UserStatus;
	reason?: string;
}

export interface IDashboardStats {
	totalUsers: number;
	totalDonors: number;
	availableDonors: number;
	totalBloodRequests: number;
	activeEmergencies: number;
	fulfilledRequests: number;
	totalDonationsCompleted: number;
	totalPaymentsVolume: number;
	totalSuccessfulPayments: number;
	requestsByBloodGroup: Record<string, number>;
	requestsByUrgency: Record<string, number>;
}
