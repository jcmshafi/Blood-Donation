import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { DonationService } from "./donation.service";

const getMatchingDonors = catchAsync(async (req: Request, res: Response) => {
	const requestId = req.params.id as string;
	const maxDistanceKm = req.query.maxDistanceKm
		? Number(req.query.maxDistanceKm)
		: undefined;

	const result = await DonationService.getMatchingDonors(requestId, {
		maxDistanceKm,
	});

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Compatible matching donors retrieved successfully",
		data: result,
	});
});

const acceptBloodRequest = catchAsync(async (req: Request, res: Response) => {
	const requestId = req.params.id as string;
	const donorUserId = req.user!.userId;

	const result = await DonationService.acceptBloodRequest(
		requestId,
		donorUserId,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message:
			"Blood donation request accepted successfully. Donor assignment created.",
		data: result,
	});
});

const updateDonationStatus = catchAsync(async (req: Request, res: Response) => {
	const assignmentId = req.params.id as string;
	const userId = req.user!.userId;
	const userRole = req.user!.role;

	const result = await DonationService.updateDonationStatus(
		assignmentId,
		userId,
		userRole,
		req.body,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Donation assignment status updated successfully",
		data: result,
	});
});

const getMyDonationHistory = catchAsync(async (req: Request, res: Response) => {
	const donorUserId = req.user!.userId;

	const result = await DonationService.getMyDonationHistory(donorUserId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message:
			"Donor donation history and statistics retrieved successfully",
		data: result,
	});
});

export const DonationController = {
	getMatchingDonors,
	acceptBloodRequest,
	updateDonationStatus,
	getMyDonationHistory,
};
