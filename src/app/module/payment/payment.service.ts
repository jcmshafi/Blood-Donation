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
import { BkashClient } from "./bkash.client";
import type {
	IBkashCallbackPayload,
	ICreatePaymentPayload,
} from "./payment.interface";

const initiateBkashPayment = async (
	payerId: string,
	payload: ICreatePaymentPayload,
	ipAddress?: string,
) => {
	// Verify target blood request exists
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

	const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

	const payer = await prisma.user.findUnique({
		where: { id: payerId },
		select: { phone: true },
	});
	const cleanPhone = payer?.phone?.replace(/\D/g, "") || "01770618575";
	const payerReference = cleanPhone.length === 11 ? cleanPhone : "01770618575";

	// Initiate payment through bKash Tokenized Checkout API
	const bkashResponse = await BkashClient.createPayment({
		amount: payload.amount,
		invoiceNumber,
		payerReference,
	});

	// Persist payment record with PENDING status
	const payment = await prisma.payment.create({
		data: {
			requestId: payload.requestId,
			payerId,
			amount: payload.amount,
			paymentMethod: PaymentMethod.BKASH,
			paymentId: bkashResponse.paymentID,
			status: PaymentStatus.PENDING,
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

	// Record audit log entry
	await prisma.auditLog.create({
		data: {
			userId: payerId,
			action: "PAYMENT_INITIATED",
			resource: "Payment",
			resourceId: payment.id,
			details: {
				paymentId: payment.paymentId,
				amount: payment.amount,
				requestId: payment.requestId,
				merchantInvoiceNumber: bkashResponse.merchantInvoiceNumber,
			},
			ipAddress,
		},
	});

	return {
		payment,
		bkashURL: bkashResponse.bkashURL,
	};
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
	const executeResponse = await BkashClient.executePayment(payload.paymentID);

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
