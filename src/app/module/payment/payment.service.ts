import { createHash, randomBytes } from "node:crypto";
import httpStatus from "http-status";
import {
	PaymentMethod,
	PaymentStatus,
	RequestStatus,
	Role,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { paymentReceiptEmailHtml, sendEmail } from "../../utils/sendEmail";
import { formatMinor } from "../../utils/money";
import { BkashClient, isBkashConfigured } from "./bkash.client";
import type {
	IBkashCallbackPayload,
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
 * Starts a bKash checkout. The pending attempt is stored before the gateway is
 * contacted; a repeated Idempotency-Key replays the stored attempt.
 */
const initiateBkashPayment = async (
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
			bkashURL:
				existing.status === PaymentStatus.PENDING ? existing.checkoutUrl : null,
		};
	};

	const replayed = await replay();
	if (replayed) return replayed;

	if (!isBkashConfigured()) {
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

	const payer = await prisma.user.findUnique({
		where: { id: payerId },
		select: { phone: true },
	});
	const cleanPhone = payer?.phone?.replace(/\D/g, "") || "";
	const payerReference = cleanPhone.length === 11 ? cleanPhone : "01700000000";

	const invoiceNumber = `INV-${Date.now()}-${randomBytes(4).toString("hex")}`;

	// Persist the attempt first. paymentId is replaced by bKash's paymentID once known.
	let attempt: Awaited<ReturnType<typeof prisma.payment.create>>;
	try {
		attempt = await prisma.payment.create({
			data: {
				requestId: payload.requestId,
				payerId,
				amount: payload.amountMinor / 100,
				amountMinor: payload.amountMinor,
				currency: "BDT",
				paymentMethod: PaymentMethod.BKASH,
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
				provider: "BKASH",
				amountMinor: attempt.amountMinor,
				currency: attempt.currency,
				requestId: attempt.requestId,
				merchantInvoiceNumber: invoiceNumber,
			},
			ipAddress,
		},
	});

	try {
		const bkashResponse = await BkashClient.createPayment({
			amount: formatMinor(payload.amountMinor),
			invoiceNumber,
			payerReference,
		});
		const updated = await prisma.payment.update({
			where: { id: attempt.id },
			data: {
				paymentId: bkashResponse.paymentID,
				checkoutUrl: bkashResponse.bkashURL,
			},
		});
		return {
			replayed: false as const,
			payment: toPaymentSummary(updated),
			bkashURL: bkashResponse.bkashURL as string | null,
		};
	} catch {
		await prisma.payment.update({
			where: { id: attempt.id },
			data: {
				status: PaymentStatus.FAILED,
				failureReason: "Gateway could not create a checkout session",
			},
		});
		await prisma.auditLog.create({
			data: {
				userId: payerId,
				action: "PAYMENT_FAILED",
				resource: "Payment",
				resourceId: attempt.id,
				details: { stage: "initiation", reason: "gateway_error" },
				ipAddress,
			},
		});
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"The payment gateway could not start checkout. Please try again.",
		);
	}
};

const handleBkashCallback = async (
	payload: IBkashCallbackPayload,
	ipAddress?: string,
) => {
	const payment = await prisma.payment.findUnique({
		where: { paymentId: payload.paymentID },
		include: {
			request: true,
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
		throw new AppError(httpStatus.NOT_FOUND, "Payment transaction not found");
	}

	// Handle explicit user cancellation or failure from bKash redirect
	if (payload.status === "cancel") {
		const updated = await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.CANCELLED },
		});
		await prisma.auditLog.create({
			data: {
				userId: payment.payerId,
				action: "PAYMENT_CANCELLED",
				resource: "Payment",
				resourceId: payment.id,
				details: { paymentId: payment.paymentId, status: "cancel" },
				ipAddress,
			},
		});
		return updated;
	}

	if (payload.status === "failure") {
		const updated = await prisma.payment.update({
			where: { id: payment.id },
			data: { status: PaymentStatus.FAILED },
		});
		await prisma.auditLog.create({
			data: {
				userId: payment.payerId,
				action: "PAYMENT_FAILED",
				resource: "Payment",
				resourceId: payment.id,
				details: { paymentId: payment.paymentId, status: "failure" },
				ipAddress,
			},
		});
		return updated;
	}

	// If already completed, return existing record
	if (payment.status === PaymentStatus.COMPLETED) {
		return payment;
	}

	// Execute payment through bKash Tokenized Checkout
	let executeResponse: Awaited<ReturnType<typeof BkashClient.executePayment>>;
	try {
		executeResponse = await BkashClient.executePayment(payload.paymentID);
	} catch {
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"bKash could not confirm this payment yet",
		);
	}

	// Atomically complete the payment record
	const completedPayment = await prisma.payment.update({
		where: { id: payment.id },
		data: {
			status: PaymentStatus.COMPLETED,
			transactionId: executeResponse.trxID,
			paymentExecuteResponse: executeResponse as any,
		},
		include: {
			request: {
				select: {
					id: true,
					patientName: true,
					bloodGroup: true,
					hospitalName: true,
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

	// Record audit log for successful transaction
	await prisma.auditLog.create({
		data: {
			userId: payment.payerId,
			action: "PAYMENT_COMPLETED",
			resource: "Payment",
			resourceId: completedPayment.id,
			details: {
				paymentId: completedPayment.paymentId,
				transactionId: completedPayment.transactionId,
				amount: completedPayment.amount,
			},
			ipAddress,
		},
	});

	// Dispatch transactional payment receipt email
	if (completedPayment.payer?.email) {
		sendEmail({
			to: completedPayment.payer.email,
			subject: `bKash Payment Receipt: ${completedPayment.amount} BDT (TrxID: ${completedPayment.transactionId})`,
			html: paymentReceiptEmailHtml(
				completedPayment.payer.name,
				completedPayment.amount,
				completedPayment.transactionId || "N/A",
				completedPayment.paymentId,
			),
		}).catch((err) =>
			console.error("Payment receipt email dispatch error:", err),
		);
	}

	return completedPayment;
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
	initiateBkashPayment,
	handleBkashCallback,
	getPaymentById,
};
