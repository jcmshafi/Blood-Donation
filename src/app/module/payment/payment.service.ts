import { createHash, randomBytes } from "node:crypto";
import httpStatus from "http-status";
import {
	PaymentMethod,
	PaymentStatus,
	RequestStatus,
	Role,
} from "../../../generated/prisma/enums";
import config from "../../config/index";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { paymentReceiptEmailHtml, sendEmail } from "../../utils/sendEmail";
import { formatMinor, parseStoredAmountToMinor } from "../../utils/money";
import {
	BkashClient,
	BkashDeclinedError,
	isBkashConfigured,
} from "./bkash.client";
import {
	isStripeConfigured,
	StripeGateway,
	StripeGatewayError,
} from "./stripe.client";
import type { MyPaymentsQuery } from "./payment.query";
import type {
	IBkashCallbackPayload,
	IBkashExecutePaymentResponse,
	IBkashQueryPaymentResponse,
	ICreatePaymentPayload,
} from "./payment.interface";

const RACE_ERROR_CODE = "P2002";

type PaymentSummarySource = {
	id: string;
	requestId: string;
	status: PaymentStatus;
	paymentMethod: PaymentMethod;
	currency: string;
	amountMinor: number;
	paymentId: string;
	createdAt: Date;
};

const toPaymentSummary = (payment: PaymentSummarySource) => ({
	id: payment.id,
	requestId: payment.requestId,
	status: payment.status,
	paymentMethod: payment.paymentMethod,
	currency: payment.currency,
	amount: formatMinor(payment.amountMinor),
	paymentId: payment.paymentId,
	createdAt: payment.createdAt,
});

const fingerprintOf = (requestId: string, amountMinor: number) =>
	createHash("sha256").update(`${requestId}|${amountMinor}`).digest("hex");

/**
 * Starts a Stripe Checkout (test mode). The pending attempt is stored before Stripe is
 * contacted; a repeated Idempotency-Key replays the stored attempt.
 */
const initiateStripePayment = async (
	payerId: string,
	payload: ICreatePaymentPayload,
	idempotencyKey: string,
	ipAddress?: string,
) => {
	const fingerprint = fingerprintOf(payload.requestId, payload.amountMinor);

	const replay = async () => {
		const existing = await prisma.payment.findUnique({
			where: { payerId_idempotencyKey: { payerId, idempotencyKey } },
		});
		if (!existing) return null;
		if (existing.initiationFingerprint !== fingerprint) {
			throw new AppError(
				httpStatus.UNPROCESSABLE_ENTITY,
				"This Idempotency-Key was already used with a different request or amount",
			);
		}
		return {
			replayed: true as const,
			payment: toPaymentSummary(existing),
			checkoutUrl:
				existing.status === PaymentStatus.PENDING ? existing.checkoutUrl : null,
		};
	};

	const replayed = await replay();
	if (replayed) return replayed;

	if (!isStripeConfigured()) {
		throw new AppError(
			httpStatus.SERVICE_UNAVAILABLE,
			"Payments are temporarily unavailable",
		);
	}

	const bloodRequest = await prisma.bloodRequest.findUnique({
		where: { id: payload.requestId, isDeleted: false },
	});
	if (!bloodRequest) {
		throw new AppError(httpStatus.NOT_FOUND, "Blood request not found");
	}
	if (bloodRequest.status === RequestStatus.CANCELLED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Cannot initiate payment for a cancelled blood request",
		);
	}

	const invoiceNumber = `INV-${Date.now()}-${randomBytes(4).toString("hex")}`;

	// Persist the attempt first. paymentId is replaced by the Stripe session ID once known.
	let attempt: Awaited<ReturnType<typeof prisma.payment.create>>;
	try {
		attempt = await prisma.payment.create({
			data: {
				requestId: payload.requestId,
				payerId,
				amount: payload.amountMinor / 100,
				amountMinor: payload.amountMinor,
				currency: config.stripe_currency.toUpperCase(),
				paymentMethod: PaymentMethod.STRIPE,
				paymentId: `PENDING-${randomBytes(16).toString("hex")}`,
				merchantInvoiceNumber: invoiceNumber,
				idempotencyKey,
				initiationFingerprint: fingerprint,
				status: PaymentStatus.PENDING,
			},
		});
	} catch (error) {
		if ((error as { code?: string }).code === RACE_ERROR_CODE) {
			const raced = await replay();
			if (raced) return raced;
		}
		throw error;
	}

	await prisma.auditLog.create({
		data: {
			userId: payerId,
			action: "PAYMENT_INITIATED",
			resource: "Payment",
			resourceId: attempt.id,
			details: {
				provider: "STRIPE",
				amountMinor: attempt.amountMinor,
				currency: attempt.currency,
				requestId: attempt.requestId,
				merchantInvoiceNumber: invoiceNumber,
			},
			ipAddress,
		},
	});

	const returnUrl = (page: "success" | "cancel") => {
		const url = new URL(`/payment/${page}`, config.frontend_url as string);
		url.searchParams.set("payment", attempt.id);
		return url.toString();
	};

	try {
		const session = await StripeGateway.createCheckoutSession({
			paymentRecordId: attempt.id,
			requestId: payload.requestId,
			amountMinor: payload.amountMinor,
			currency: config.stripe_currency.toLowerCase(),
			idempotencyKey,
			successUrl: returnUrl("success"),
			cancelUrl: returnUrl("cancel"),
		});
		const updated = await prisma.payment.update({
			where: { id: attempt.id },
			data: { paymentId: session.id, checkoutUrl: session.url },
		});
		return {
			replayed: false as const,
			payment: toPaymentSummary(updated),
			checkoutUrl: session.url as string | null,
		};
	} catch (error) {
		// Log the gateway reason for operators only (no credentials); callers get a generic message.
		console.error(
			"Stripe checkout creation failed:",
			error instanceof Error ? error.message : error,
		);
		const tooSmall =
			error instanceof StripeGatewayError && error.code === "amount_too_small";
		await prisma.payment.update({
			where: { id: attempt.id },
			data: {
				status: PaymentStatus.FAILED,
				failureReason: tooSmall
					? "Amount is below the minimum the payment provider accepts"
					: "Gateway could not create a checkout session",
			},
		});
		await prisma.auditLog.create({
			data: {
				userId: payerId,
				action: "PAYMENT_FAILED",
				resource: "Payment",
				resourceId: attempt.id,
				details: {
					stage: "initiation",
					reason: tooSmall ? "amount_too_small" : "gateway_error",
				},
				ipAddress,
			},
		});
		throw tooSmall
			? new AppError(
					httpStatus.BAD_REQUEST,
					"That amount is below the minimum the payment provider accepts. Please enter a larger amount.",
				)
			: new AppError(
					httpStatus.BAD_GATEWAY,
					"The payment gateway could not start checkout. Please try again.",
				);
	}
};

type CallbackOutcome = "completed" | "cancelled" | "failed" | "pending";

const OUTCOME_BY_STATUS: Record<PaymentStatus, CallbackOutcome> = {
	[PaymentStatus.COMPLETED]: "completed",
	[PaymentStatus.CANCELLED]: "cancelled",
	[PaymentStatus.FAILED]: "failed",
	[PaymentStatus.PENDING]: "pending",
};

type StoredPayment = {
	id: string;
	requestId: string;
	payerId: string;
	status: PaymentStatus;
	paymentMethod: PaymentMethod;
	currency: string;
	amountMinor: number;
	paymentId: string;
	transactionId: string | null;
	failureReason: string | null;
	createdAt: Date;
};

const toCallbackResult = (payment: StoredPayment) => ({
	outcome: OUTCOME_BY_STATUS[payment.status],
	payment: {
		...toPaymentSummary(payment),
		transactionId: payment.transactionId,
		failureReason: payment.failureReason,
	},
});

/** Does a bKash execute/query response match the stored attempt and report completion? */
const matchesStoredPayment = (
	payment: StoredPayment,
	data: {
		paymentID?: string;
		trxID?: string;
		transactionStatus?: string;
		amount?: string;
		currency?: string;
	},
) =>
	data.paymentID === payment.paymentId &&
	Boolean(data.trxID) &&
	data.transactionStatus?.toLowerCase() === "completed" &&
	data.currency === payment.currency &&
	parseStoredAmountToMinor(data.amount) === payment.amountMinor;

/**
 * Settles a PENDING payment exactly once. Only the caller whose conditional update
 * wins writes the audit entry and sends the receipt; every other caller just reads.
 */
const settlePending = async (
	payment: StoredPayment,
	next: {
		status: PaymentStatus;
		action: string;
		reason?: string;
		transactionId?: string;
		executeResponse?: object;
	},
	ipAddress?: string,
) => {
	const claimed = await prisma.payment.updateMany({
		where: { id: payment.id, status: PaymentStatus.PENDING },
		data: {
			status: next.status,
			...(next.reason ? { failureReason: next.reason } : {}),
			...(next.transactionId ? { transactionId: next.transactionId } : {}),
			...(next.executeResponse
				? { paymentExecuteResponse: next.executeResponse as object }
				: {}),
		},
	});

	const current = await prisma.payment.findUnique({
		where: { paymentId: payment.paymentId },
		include: { payer: { select: { id: true, name: true, email: true } } },
	});
	if (!current) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment transaction not found");
	}
	if (claimed.count === 0) return current; // another callback already settled it

	await prisma.auditLog.create({
		data: {
			userId: payment.payerId,
			action: next.action,
			resource: "Payment",
			resourceId: payment.id,
			details: {
				provider: "BKASH",
				status: next.status,
				amountMinor: payment.amountMinor,
				currency: payment.currency,
				...(next.transactionId ? { transactionId: next.transactionId } : {}),
				...(next.reason ? { reason: next.reason } : {}),
			},
			ipAddress,
		},
	});

	if (next.status === PaymentStatus.COMPLETED && current.payer?.email) {
		sendEmail({
			to: current.payer.email,
			subject: `bKash Payment Receipt: ${formatMinor(current.amountMinor)} BDT (TrxID: ${current.transactionId})`,
			html: paymentReceiptEmailHtml(
				current.payer.name,
				current.amountMinor / 100,
				current.transactionId || "N/A",
				current.paymentId,
			),
		}).catch((err) =>
			console.error("Payment receipt email dispatch error:", err),
		);
	}
	return current;
};

/**
 * bKash redirect handler. The browser `status` is only a hint for which check to run:
 * the stored attempt changes only after bKash confirms the outcome server-to-server,
 * a settled payment is never changed, and an outage leaves the payment PENDING.
 */
const handleBkashCallback = async (
	payload: IBkashCallbackPayload,
	ipAddress?: string,
) => {
	const payment = await prisma.payment.findUnique({
		where: { paymentId: payload.paymentID },
	});
	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment transaction not found");
	}
	if (payment.status !== PaymentStatus.PENDING) {
		return toCallbackResult(payment);
	}

	const complete = (
		data: IBkashExecutePaymentResponse | IBkashQueryPaymentResponse,
	) =>
		matchesStoredPayment(payment, data)
			? settlePending(
					payment,
					{
						status: PaymentStatus.COMPLETED,
						action: "PAYMENT_COMPLETED",
						transactionId: data.trxID,
						executeResponse: data,
					},
					ipAddress,
				)
			: settlePending(
					payment,
					{
						status: PaymentStatus.FAILED,
						action: "PAYMENT_VERIFICATION_FAILED",
						reason: "Gateway response did not match the payment",
					},
					ipAddress,
				);

	let confirmed: StoredPayment | null = null;

	if (payload.status === "success") {
		try {
			const executed = await BkashClient.executePayment(payload.paymentID);
			confirmed = await complete(executed);
		} catch (error) {
			if (!(error instanceof BkashDeclinedError)) {
				return toCallbackResult(payment); // outage: stay PENDING
			}
			// Declined (for example already executed): fall through to the status query.
		}
	}

	if (!confirmed) {
		let remote: IBkashQueryPaymentResponse;
		try {
			remote = await BkashClient.queryPayment(payload.paymentID);
		} catch {
			return toCallbackResult(payment); // cannot confirm: stay PENDING
		}
		const remoteStatus = remote.transactionStatus.toLowerCase();
		if (remoteStatus === "completed") {
			confirmed = await complete(remote);
		} else if (remoteStatus === "cancelled" || remoteStatus === "canceled") {
			confirmed = await settlePending(
				payment,
				{ status: PaymentStatus.CANCELLED, action: "PAYMENT_CANCELLED" },
				ipAddress,
			);
		} else if (remoteStatus === "failed" || remoteStatus === "expired") {
			confirmed = await settlePending(
				payment,
				{
					status: PaymentStatus.FAILED,
					action: "PAYMENT_FAILED",
					reason: "bKash reported the payment as unsuccessful",
				},
				ipAddress,
			);
		}
		// Still initiated/authorized at bKash: nothing is confirmed, stay PENDING.
	}

	return toCallbackResult(confirmed ?? payment);
};

const getMyPayments = async (payerId: string, filters: MyPaymentsQuery) => {
	const { page, limit, status, sortBy, sortOrder } = filters;
	const where = { payerId, ...(status ? { status } : {}) };

	const [total, rows] = await Promise.all([
		prisma.payment.count({ where }),
		prisma.payment.findMany({
			where,
			skip: (page - 1) * limit,
			take: limit,
			orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
			select: {
				id: true,
				requestId: true,
				status: true,
				paymentMethod: true,
				currency: true,
				amountMinor: true,
				paymentId: true,
				transactionId: true,
				failureReason: true,
				createdAt: true,
				request: {
					select: { id: true, bloodGroup: true, hospitalName: true },
				},
			},
		}),
	]);

	return {
		meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
		result: rows.map(({ request, ...row }) => ({
			...toPaymentSummary(row),
			transactionId: row.transactionId,
			failureReason: row.failureReason,
			request,
		})),
	};
};

const getPaymentById = async (
	paymentIdOrRecordId: string,
	userId: string,
	userRole: Role,
) => {
	const payment = await prisma.payment.findFirst({
		where: {
			OR: [{ id: paymentIdOrRecordId }, { paymentId: paymentIdOrRecordId }],
		},
		omit: {
			paymentExecuteResponse: true,
			idempotencyKey: true,
			initiationFingerprint: true,
			checkoutUrl: true,
		},
		include: {
			request: {
				select: {
					id: true,
					patientName: true,
					bloodGroup: true,
					hospitalName: true,
					hospitalAddress: true,
					urgency: true,
					status: true,
				},
			},
			payer: {
				select: {
					id: true,
					name: true,
					email: true,
					phone: true,
				},
			},
		},
	});

	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment record not found");
	}

	// Check permission: Must be payer or admin
	if (userRole !== Role.ADMIN && payment.payerId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to view this payment record",
		);
	}

	return payment;
};

export const PaymentService = {
	getMyPayments,
	initiateStripePayment,
	handleBkashCallback,
	getPaymentById,
};
