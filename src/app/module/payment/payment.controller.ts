import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { PaymentService } from "./payment.service";

const initiateBkashPayment = catchAsync(async (req: Request, res: Response) => {
	const payerId = req.user!.userId;
	const result = await PaymentService.initiateBkashPayment(
		payerId,
		req.body,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "bKash payment initiated successfully",
		data: result,
	});
});

const handleBkashCallback = catchAsync(async (req: Request, res: Response) => {
	const paymentID = (req.body.paymentID || req.query.paymentID) as string;
	const status = (req.body.status || req.query.status) as string | undefined;

	const result = await PaymentService.handleBkashCallback(
		{ paymentID, status },
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "bKash payment processed successfully",
		data: result,
	});
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const userId = req.user!.userId;
	const userRole = req.user!.role;

	const result = await PaymentService.getPaymentById(id, userId, userRole);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment details retrieved successfully",
		data: result,
	});
});

export const PaymentController = {
	initiateBkashPayment,
	handleBkashCallback,
	getPaymentById,
};
