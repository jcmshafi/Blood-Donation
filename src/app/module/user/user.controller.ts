import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserService } from "./user.service";

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await UserService.getMyProfile(userId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile fetched successfully",
		data: result,
	});
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await UserService.updateMyProfile(userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User profile updated successfully",
		data: result,
	});
});

const updateDonorProfile = catchAsync(async (req: Request, res: Response) => {
	const userId = req.user!.userId;
	const result = await UserService.updateDonorProfile(userId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Donor profile updated successfully",
		data: result,
	});
});

export const UserController = {
	getMyProfile,
	updateMyProfile,
	updateDonorProfile,
};
