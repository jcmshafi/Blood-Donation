import type { Request, Response } from "express";
import httpStatus from "http-status";
import config from "../../config/index";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { myPaymentsQuerySchema } from "./payment.query";
import { PaymentService } from "./payment.service";
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

const OUTCOME_PAGE = {
	completed: "success",
	cancelled: "cancel",
	failed: "failure",
} as const;

/** Server-built redirect: only a payment record reference travels in the URL, never a status. */
const outcomeRedirect = (page: string, paymentRecordId?: string) => {
	if (!config.frontend_url) return null;
	try {
		const url = new URL(`/payment/${page}`, config.frontend_url);
		if (paymentRecordId) url.searchParams.set("payment", paymentRecordId);
		return url.toString();
	} catch {
		return null;
	}
};

/** bKash checkout was retired: its sandbox rejects every callback URL. Existing bKash records stay readable. */
const retiredBkashCreate = (_req: Request, res: Response) => {
	res.status(httpStatus.GONE).json({
		success: false,
		message:
			"bKash checkout has been retired. Use POST /api/v1/payments/stripe/checkout.",
		errors: [],
	});
};

const handleBkashCallback = catchAsync(async (req: Request, res: Response) => {
	const read = (name: string) => {
		const value = req.body?.[name] ?? req.query[name];
		return typeof value === "string" ? value : undefined;
	};
	const paymentID = read("paymentID");
	const hint = read("status");

	if (!paymentID || paymentID.length > 128) {
		throw new AppError(httpStatus.BAD_REQUEST, "A valid paymentID is required");
	}

	// Browsers return via GET and are redirected; API callers (POST) get JSON.
	const redirecting = req.method === "GET";
	res.setHeader("Cache-Control", "no-store");

	let result: Awaited<ReturnType<typeof PaymentService.handleBkashCallback>>;
	try {
		result = await PaymentService.handleBkashCallback(
			{ paymentID, status: hint },
			req.ip,
		);
	} catch (error) {
		const target = redirecting && outcomeRedirect("failure");
		if (target && error instanceof AppError && error.statusCode === 404) {
			return res.redirect(target);
		}
		throw error;
	}

	if (redirecting) {
		const page =
			result.outcome === "pending"
				? hint === "cancel"
					? "cancel"
					: hint === "failure"
						? "failure"
						: "success"
				: OUTCOME_PAGE[result.outcome];
		const target = outcomeRedirect(page, result.payment.id);
		if (target) return res.redirect(target);
	}

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: `bKash payment ${result.outcome}`,
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

	const result = await PaymentService.getPaymentById(id, userId, userRole);

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
	handleBkashCallback,
	getPaymentById,
};
