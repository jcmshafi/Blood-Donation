import type { Request, Response } from "express";
import httpStatus from "http-status";
import type {
	BloodGroup,
	RequestStatus,
	UrgencyLevel,
} from "../../../generated/prisma/enums";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type { IBloodRequestFilterOptions } from "./bloodRequest.interface";
import { BloodRequestService } from "./bloodRequest.service";

const createBloodRequest = catchAsync(async (req: Request, res: Response) => {
	const requesterId = req.user!.userId;
	const result = await BloodRequestService.createBloodRequest(
		requesterId,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Emergency blood request created successfully",
		data: result,
	});
});

const getAllBloodRequests = catchAsync(async (req: Request, res: Response) => {
	const filters: IBloodRequestFilterOptions = {
		searchTerm: req.query.searchTerm ? String(req.query.searchTerm) : undefined,
		bloodGroup: req.query.bloodGroup
			? (String(req.query.bloodGroup) as BloodGroup)
			: undefined,
		urgency: req.query.urgency
			? (String(req.query.urgency) as UrgencyLevel)
			: undefined,
		status: req.query.status
			? (String(req.query.status) as RequestStatus)
			: undefined,
		page: req.query.page ? Number(req.query.page) : 1,
		limit: req.query.limit ? Number(req.query.limit) : 10,
		sortBy: req.query.sortBy ? String(req.query.sortBy) : "createdAt",
		sortOrder: req.query.sortOrder === "asc" ? "asc" : "desc",
	};

	const result = await BloodRequestService.getAllBloodRequests(filters);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blood requests retrieved successfully",
		data: result,
	});
});

const getBloodRequestById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const result = await BloodRequestService.getBloodRequestById(id);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blood request details retrieved successfully",
		data: result,
	});
});

const updateBloodRequest = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const userId = req.user!.userId;
	const userRole = req.user!.role;

	const result = await BloodRequestService.updateBloodRequest(
		id,
		userId,
		userRole,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blood request updated successfully",
		data: result,
	});
});

const deleteBloodRequest = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const userId = req.user!.userId;
	const userRole = req.user!.role;

	await BloodRequestService.deleteBloodRequest(id, userId, userRole);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blood request deleted successfully",
		data: null,
	});
});

export const BloodRequestController = {
	createBloodRequest,
	getAllBloodRequests,
	getBloodRequestById,
	updateBloodRequest,
	deleteBloodRequest,
};
