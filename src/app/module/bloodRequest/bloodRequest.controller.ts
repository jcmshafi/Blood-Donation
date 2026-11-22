import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import {
	publicRequestQuerySchema,
	publicRequestIdSchema,
} from "./bloodRequest.public";
import { BloodRequestService } from "./bloodRequest.service";
import {
	getOwnedBloodRequests,
	ownedRequestQuerySchema,
} from "./bloodRequest.owned";

const getMyBloodRequests = catchAsync(async (req: Request, res: Response) => {
	const filters = ownedRequestQuerySchema.parse(req.query);
	const result = await getOwnedBloodRequests(req.user!.userId, filters);
	res.setHeader("Cache-Control", "private, no-store");
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Your blood requests retrieved successfully",
		data: result,
	});
});

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
	const filters = publicRequestQuerySchema.parse(req.query);

	const result = await BloodRequestService.getAllBloodRequests(filters);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blood requests retrieved successfully",
		data: result,
	});
});

const getBloodRequestById = catchAsync(async (req: Request, res: Response) => {
	const id = publicRequestIdSchema.parse(req.params.id);
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
	getMyBloodRequests,
	createBloodRequest,
	getAllBloodRequests,
	getBloodRequestById,
	updateBloodRequest,
	deleteBloodRequest,
};
