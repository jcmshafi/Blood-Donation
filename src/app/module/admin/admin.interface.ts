import type { Role, UserStatus } from "../../../generated/prisma/enums";

export interface IAdminUserFilterOptions {
	page?: number;
	limit?: number;
	role?: Role;
	status?: UserStatus;
	searchTerm?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

export interface IUpdateUserStatusPayload {
	status: UserStatus;
	reason?: string;
}

export interface IAuditLogFilterOptions {
	page?: number;
	limit?: number;
	action?: string;
	resource?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
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
