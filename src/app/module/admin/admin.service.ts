import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
	DonationStatus,
	PaymentStatus,
	RequestStatus,
	Role,
	UserStatus,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { cache } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import type {
	IAdminUserFilterOptions,
	IAuditLogFilterOptions,
	IDashboardStats,
	IUpdateUserStatusPayload,
} from "./admin.interface";

const getAllUsers = async (filters: IAdminUserFilterOptions) => {
	const {
		page = 1,
		limit = 10,
		role,
		status,
		searchTerm,
		sortBy = "createdAt",
		sortOrder = "desc",
	} = filters;

	const andConditions: Prisma.UserWhereInput[] = [{ isDeleted: false }];

	if (searchTerm) {
		andConditions.push({
			OR: [
				{ name: { contains: searchTerm, mode: "insensitive" } },
				{ email: { contains: searchTerm, mode: "insensitive" } },
				{ phone: { contains: searchTerm, mode: "insensitive" } },
				{ address: { contains: searchTerm, mode: "insensitive" } },
			],
		});
	}

	if (role) {
		andConditions.push({ role });
	}

	if (status) {
		andConditions.push({ status });
	}

	const where: Prisma.UserWhereInput = { AND: andConditions };

	const parsedPage = Number(page) > 0 ? Number(page) : 1;
	const parsedLimit = Number(limit) > 0 ? Number(limit) : 10;
	const skip = (parsedPage - 1) * parsedLimit;

	const [total, result] = await Promise.all([
		prisma.user.count({ where }),
		prisma.user.findMany({
			where,
			skip,
			take: parsedLimit,
			orderBy: {
				[sortBy]: sortOrder === "asc" ? "asc" : "desc",
			},
			omit: {
				password: true,
			},
			include: {
				donorProfile: true,
			},
		}),
	]);

	const totalPages = Math.ceil(total / parsedLimit);

	return {
		meta: {
			page: parsedPage,
			limit: parsedLimit,
			total,
			totalPages,
		},
		result,
	};
};

const updateUserStatus = async (
	adminUserId: string,
	targetUserId: string,
	payload: IUpdateUserStatusPayload,
	ipAddress?: string,
) => {
	const targetUser = await prisma.user.findUnique({
		where: { id: targetUserId, isDeleted: false },
	});

	if (!targetUser) {
		throw new AppError(httpStatus.NOT_FOUND, "Target user not found or deleted");
	}

	if (adminUserId === targetUserId && payload.status === UserStatus.BLOCKED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Admins are not permitted to block their own active account",
		);
	}

	const previousStatus = targetUser.status;

	const updatedUser = await prisma.user.update({
		where: { id: targetUserId },
		data: { status: payload.status },
		omit: {
			password: true,
		},
		include: {
			donorProfile: true,
		},
	});

	// Record audit log for governance and compliance
	await prisma.auditLog.create({
		data: {
			userId: adminUserId,
			action:
				payload.status === UserStatus.BLOCKED
					? "USER_BLOCKED"
					: "USER_ACTIVATED",
			resource: "User",
			resourceId: targetUserId,
			details: {
				previousStatus,
				newStatus: payload.status,
				reason: payload.reason || "Administrative moderation action",
				targetUserEmail: targetUser.email,
				targetUserRole: targetUser.role,
			},
			ipAddress: ipAddress || null,
		},
	});

	// Invalidate dashboard and donor caches
	await Promise.all([
		cache.del("cache:admin:dashboard-stats"),
		cache.delByPattern("cache:matching-donors:*"),
	]);

	return updatedUser;
};

const getDashboardStats = async (): Promise<IDashboardStats> => {
	const cacheKey = "cache:admin:dashboard-stats";
	const cachedData = await cache.get(cacheKey);
	if (cachedData) {
		try {
			return JSON.parse(cachedData);
		} catch {
			// fallback to fresh query
		}
	}

	const [
		totalUsers,
		totalDonors,
		availableDonors,
		totalBloodRequests,
		activeEmergencies,
		fulfilledRequests,
		totalDonationsCompleted,
		paymentsSummary,
		requestsByBloodGroupRaw,
		requestsByUrgencyRaw,
	] = await Promise.all([
		prisma.user.count({ where: { isDeleted: false } }),
		prisma.user.count({ where: { role: Role.DONOR, isDeleted: false } }),
		prisma.donorProfile.count({
			where: {
				isAvailable: true,
				user: { isDeleted: false },
			},
		}),
		prisma.bloodRequest.count({ where: { isDeleted: false } }),
		prisma.bloodRequest.count({
			where: {
				isDeleted: false,
				status: { in: [RequestStatus.OPEN, RequestStatus.MATCHED] },
			},
		}),
		prisma.bloodRequest.count({
			where: {
				isDeleted: false,
				status: RequestStatus.FULFILLED,
			},
		}),
		prisma.donationAssignment.count({
			where: { status: DonationStatus.COMPLETED },
		}),
		prisma.payment.aggregate({
			_sum: { amount: true },
			_count: { id: true },
			where: { status: PaymentStatus.COMPLETED },
		}),
		prisma.bloodRequest.groupBy({
			by: ["bloodGroup"],
			where: { isDeleted: false },
			_count: { id: true },
		}),
		prisma.bloodRequest.groupBy({
			by: ["urgency"],
			where: { isDeleted: false },
			_count: { id: true },
		}),
	]);

	const requestsByBloodGroup: Record<string, number> = {};
	for (const item of requestsByBloodGroupRaw) {
		requestsByBloodGroup[item.bloodGroup] = item._count.id;
	}

	const requestsByUrgency: Record<string, number> = {};
	for (const item of requestsByUrgencyRaw) {
		requestsByUrgency[item.urgency] = item._count.id;
	}

	const statsResult: IDashboardStats = {
		totalUsers,
		totalDonors,
		availableDonors,
		totalBloodRequests,
		activeEmergencies,
		fulfilledRequests,
		totalDonationsCompleted,
		totalPaymentsVolume: paymentsSummary._sum.amount || 0,
		totalSuccessfulPayments: paymentsSummary._count.id || 0,
		requestsByBloodGroup,
		requestsByUrgency,
	};

	await cache.set(cacheKey, JSON.stringify(statsResult), 30);

	return statsResult;
};

const getAuditLogs = async (filters: IAuditLogFilterOptions) => {
	const {
		page = 1,
		limit = 20,
		action,
		resource,
		sortBy = "createdAt",
		sortOrder = "desc",
	} = filters;

	const andConditions: Prisma.AuditLogWhereInput[] = [];

	if (action) {
		andConditions.push({
			action: { contains: action, mode: "insensitive" },
		});
	}

	if (resource) {
		andConditions.push({
			resource: { contains: resource, mode: "insensitive" },
		});
	}

	const where: Prisma.AuditLogWhereInput =
		andConditions.length > 0 ? { AND: andConditions } : {};

	const parsedPage = Number(page) > 0 ? Number(page) : 1;
	const parsedLimit = Number(limit) > 0 ? Number(limit) : 20;
	const skip = (parsedPage - 1) * parsedLimit;

	const [total, result] = await Promise.all([
		prisma.auditLog.count({ where }),
		prisma.auditLog.findMany({
			where,
			skip,
			take: parsedLimit,
			orderBy: {
				[sortBy]: sortOrder === "asc" ? "asc" : "desc",
			},
			include: {
				user: {
					select: {
						id: true,
						name: true,
						email: true,
						role: true,
					},
				},
			},
		}),
	]);

	const totalPages = Math.ceil(total / parsedLimit);

	return {
		meta: {
			page: parsedPage,
			limit: parsedLimit,
			total,
			totalPages,
		},
		result,
	};
};

export const AdminService = {
	getAllUsers,
	updateUserStatus,
	getDashboardStats,
	getAuditLogs,
};
