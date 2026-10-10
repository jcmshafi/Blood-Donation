import httpStatus from "http-status";
import { Prisma } from "../../../generated/prisma/client";
import { Role, UrgencyLevel } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	ICreateBloodRequestPayload,
	IUpdateBloodRequestPayload,
	IBloodRequestFilterOptions,
} from "./bloodRequest.interface";

const createBloodRequest = async (
	requesterId: string,
	payload: ICreateBloodRequestPayload,
) => {
	const result = await prisma.bloodRequest.create({
		data: {
			requesterId,
			patientName: payload.patientName,
			bloodGroup: payload.bloodGroup,
			unitsNeeded: payload.unitsNeeded ?? 1,
			unitsFulfilled: 0,
			hospitalName: payload.hospitalName,
			hospitalAddress: payload.hospitalAddress,
			latitude: payload.latitude,
			longitude: payload.longitude,
			contactNumber: payload.contactNumber,
			urgency: payload.urgency ?? UrgencyLevel.NORMAL,
			notes: payload.notes,
		},
		include: {
			requester: {
				omit: {
					password: true,
				},
			},
		},
	});

	// Record activity in AuditLog
	await prisma.auditLog.create({
		data: {
			userId: requesterId,
			action: "CREATE_BLOOD_REQUEST",
			resource: "BloodRequest",
			resourceId: result.id,
			details: {
				bloodGroup: result.bloodGroup,
				urgency: result.urgency,
				hospitalName: result.hospitalName,
			},
		},
	});

	return result;
};

const getAllBloodRequests = async (filters: IBloodRequestFilterOptions) => {
	const {
		searchTerm,
		bloodGroup,
		urgency,
		status,
		page = 1,
		limit = 10,
		sortBy = "createdAt",
		sortOrder = "desc",
	} = filters;

	const andConditions: Prisma.BloodRequestWhereInput[] = [
		{ isDeleted: false },
	];

	if (searchTerm) {
		andConditions.push({
			OR: [
				{ patientName: { contains: searchTerm, mode: "insensitive" } },
				{ hospitalName: { contains: searchTerm, mode: "insensitive" } },
				{ hospitalAddress: { contains: searchTerm, mode: "insensitive" } },
			],
		});
	}

	if (bloodGroup) {
		andConditions.push({ bloodGroup });
	}

	if (urgency) {
		andConditions.push({ urgency });
	}

	if (status) {
		andConditions.push({ status });
	}

	const where: Prisma.BloodRequestWhereInput = { AND: andConditions };

	const parsedPage = Number(page) > 0 ? Number(page) : 1;
	const parsedLimit = Number(limit) > 0 ? Number(limit) : 10;
	const skip = (parsedPage - 1) * parsedLimit;

	const [total, result] = await Promise.all([
		prisma.bloodRequest.count({ where }),
		prisma.bloodRequest.findMany({
			where,
			skip,
			take: parsedLimit,
			orderBy: {
				[sortBy]: sortOrder === "asc" ? "asc" : "desc",
			},
			include: {
				requester: {
					omit: {
						password: true,
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

const getBloodRequestById = async (id: string) => {
	const request = await prisma.bloodRequest.findUnique({
		where: { id, isDeleted: false },
		include: {
			requester: {
				omit: {
					password: true,
				},
			},
			assignments: {
				include: {
					donor: {
						omit: {
							password: true,
						},
						include: {
							donorProfile: true,
						},
					},
				},
			},
		},
	});

	if (!request) {
		throw new AppError(httpStatus.NOT_FOUND, "Blood request not found");
	}

	return request;
};

const updateBloodRequest = async (
	id: string,
	userId: string,
	userRole: Role,
	payload: IUpdateBloodRequestPayload,
) => {
	const existingRequest = await prisma.bloodRequest.findUnique({
		where: { id, isDeleted: false },
	});

	if (!existingRequest) {
		throw new AppError(httpStatus.NOT_FOUND, "Blood request not found");
	}

	if (userRole !== Role.ADMIN && existingRequest.requesterId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to update this blood request",
		);
	}

	const updated = await prisma.bloodRequest.update({
		where: { id },
		data: payload,
		include: {
			requester: {
				omit: {
					password: true,
				},
			},
		},
	});

	await prisma.auditLog.create({
		data: {
			userId,
			action: "UPDATE_BLOOD_REQUEST",
			resource: "BloodRequest",
			resourceId: id,
			details: payload as Prisma.InputJsonValue,
		},
	});

	return updated;
};

const deleteBloodRequest = async (
	id: string,
	userId: string,
	userRole: Role,
) => {
	const existingRequest = await prisma.bloodRequest.findUnique({
		where: { id, isDeleted: false },
	});

	if (!existingRequest) {
		throw new AppError(httpStatus.NOT_FOUND, "Blood request not found");
	}

	if (userRole !== Role.ADMIN && existingRequest.requesterId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to delete this blood request",
		);
	}

	// Soft delete with timestamp
	const softDeleted = await prisma.bloodRequest.update({
		where: { id },
		data: {
			isDeleted: true,
			deletedAt: new Date(),
		},
	});

	await prisma.auditLog.create({
		data: {
			userId,
			action: "SOFT_DELETE_BLOOD_REQUEST",
			resource: "BloodRequest",
			resourceId: id,
		},
	});

	return softDeleted;
};

export const BloodRequestService = {
	createBloodRequest,
	getAllBloodRequests,
	getBloodRequestById,
	updateBloodRequest,
	deleteBloodRequest,
};
