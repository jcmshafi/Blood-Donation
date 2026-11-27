import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { myPaymentsQuerySchema } from "./payment.query";
import { PaymentService } from "./payment.service";
import { isWebhookConfigured, StripeGateway } from "./stripe.client";
import { idempotencyKeySchema } from "./payment.validation";

const initiateStripePayment = catchAsync(
	async (req: Request, res: Response) => {
		const payerId = req.user!.userId;
		const key = idempotencyKeySchema.safeParse(req.get("idempotency-key"));
		if (!key.success) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"A valid Idempotency-Key header (16-64 characters: letters, digits, '-' or '_') is required",
			);
		}
		const { replayed, ...data } = await PaymentService.initiateStripePayment(
			payerId,
			req.body,
			key.data,
			req.ip,
		);

		res.setHeader("Cache-Control", "no-store");
		sendResponse(res, {
			statusCode: replayed ? httpStatus.OK : httpStatus.CREATED,
			success: true,
			message: replayed
				? "Payment attempt already exists"
				: "Stripe checkout started successfully",
			data,
		});
	},
);

/** bKash checkout was retired: its sandbox rejects every callback URL. Existing bKash records stay readable. */
const retiredBkashCreate = (_req: Request, res: Response) => {
	res.status(httpStatus.GONE).json({
		success: false,
		message:
			"bKash checkout has been retired. Use POST /api/v1/payments/stripe/checkout.",
		errors: [],
	});
};

/**
 * Stripe webhook. The body is the raw bytes (see stripeWebhookBodyParser) so the signature can
 * be verified before anything is parsed. Bad signatures never reach the payment logic.
 */
const handleStripeWebhook = catchAsync(async (req: Request, res: Response) => {
	res.setHeader("Cache-Control", "no-store");
	if (!isWebhookConfigured()) {
		throw new AppError(
			httpStatus.SERVICE_UNAVAILABLE,
			"Webhook receiving is not configured",
		);
	}
	if (!Buffer.isBuffer(req.body)) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid webhook payload");
	}
	let event: ReturnType<typeof StripeGateway.constructWebhookEvent>;
	try {
		event = StripeGateway.constructWebhookEvent(
			req.body,
			req.get("stripe-signature"),
		);
	} catch {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid webhook signature");
	}
	await PaymentService.handleStripeEvent(event, req.ip);
	res.status(httpStatus.OK).json({ received: true });
});

const cancelStripePayment = catchAsync(async (req: Request, res: Response) => {
	res.setHeader("Cache-Control", "private, no-store");
	const result = await PaymentService.cancelStripePayment(
		req.params.id as string,
		req.user!.userId,
		req.user!.role,
		req.ip,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `Payment ${result.outcome}`,
		data: result,
	});
});

const getMyPayments = catchAsync(async (req: Request, res: Response) => {
	res.setHeader("Cache-Control", "private, no-store");
	const filters = myPaymentsQuerySchema.parse(req.query);
	// Scope comes from the session only; the query cannot name a payer.
	const result = await PaymentService.getMyPayments(req.user!.userId, filters);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payments retrieved successfully",
		data: result,
	});
});

const getPaymentById = catchAsync(async (req: Request, res: Response) => {
	const id = req.params.id as string;
	const userId = req.user!.userId;
	const userRole = req.user!.role;

	const result = await PaymentService.getPaymentById(
		id,
		userId,
		userRole,
		req.ip,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Payment details retrieved successfully",
		data: result,
	});
});

export const PaymentController = {
	retiredBkashCreate,
	getMyPayments,
	initiateStripePayment,
	handleStripeWebhook,
	cancelStripePayment,
	getPaymentById,
};
