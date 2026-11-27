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
import { formatMinor } from "../../utils/money";
import type Stripe from "stripe";
import {
	isStripeConfigured,
	StripeGateway,
	StripeGatewayError,
} from "./stripe.client";
import type { MyPaymentsQuery } from "./payment.query";
import type { ICreatePaymentPayload } from "./payment.interface";

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

type PaymentOutcome = "completed" | "cancelled" | "failed" | "pending";

const OUTCOME_BY_STATUS: Record<PaymentStatus, PaymentOutcome> = {
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

const toOutcomeResult = (payment: StoredPayment) => ({
	outcome: OUTCOME_BY_STATUS[payment.status],
	payment: {
		...toPaymentSummary(payment),
		transactionId: payment.transactionId,
		failureReason: payment.failureReason,
	},
});

type SessionFacts = Pick<
	Stripe.Checkout.Session,
	| "id"
	| "status"
	| "payment_status"
	| "amount_total"
	| "currency"
	| "payment_intent"
	| "client_reference_id"
>;

const PENDING_PREFIX = "PENDING-";

/** A paid session that matches the stored attempt on amount, currency and identity. */
const sessionMatchesPayment = (payment: StoredPayment, session: SessionFacts) =>
	session.payment_status === "paid" &&
	session.amount_total === payment.amountMinor &&
	session.currency?.toUpperCase() === payment.currency &&
	(session.id === payment.paymentId ||
		(payment.paymentId.startsWith(PENDING_PREFIX) &&
			session.client_reference_id === payment.id));

const paymentIntentId = (session: SessionFacts) =>
	typeof session.payment_intent === "string"
		? session.payment_intent
		: (session.payment_intent?.id ?? null);

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
		sessionId?: string;
		gatewayRecord?: object;
	},
	ipAddress?: string,
) => {
	const claimed = await prisma.payment.updateMany({
		where: { id: payment.id, status: PaymentStatus.PENDING },
		data: {
			status: next.status,
			...(next.reason ? { failureReason: next.reason } : {}),
			...(next.transactionId ? { transactionId: next.transactionId } : {}),
			...(next.sessionId ? { paymentId: next.sessionId } : {}),
			...(next.gatewayRecord
				? { paymentExecuteResponse: next.gatewayRecord as object }
				: {}),
		},
	});

	const current = await prisma.payment.findUnique({
		where: { id: payment.id },
		include: { payer: { select: { id: true, name: true, email: true } } },
	});
	if (!current) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment transaction not found");
	}
	if (claimed.count === 0) return current; // another request already settled it

	await prisma.auditLog.create({
		data: {
			userId: payment.payerId,
			action: next.action,
			resource: "Payment",
			resourceId: payment.id,
			details: {
				provider: payment.paymentMethod,
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
			subject: `Payment Receipt: ${formatMinor(current.amountMinor)} ${current.currency}`,
			html: paymentReceiptEmailHtml(
				current.payer.name,
				formatMinor(current.amountMinor),
				current.currency,
				current.transactionId || current.paymentId,
				current.paymentId,
			),
		}).catch((err) =>
			console.error("Payment receipt email dispatch error:", err),
		);
	}
	return current;
};

/** Completes the payment when Stripe reports it paid and it matches the attempt; otherwise records a mismatch. */
const settlePaidSession = (
	payment: StoredPayment,
	session: SessionFacts,
	ipAddress?: string,
) =>
	sessionMatchesPayment(payment, session)
		? settlePending(
				payment,
				{
					status: PaymentStatus.COMPLETED,
					action: "PAYMENT_COMPLETED",
					transactionId: paymentIntentId(session) ?? session.id,
					sessionId: session.id,
					gatewayRecord: {
						sessionId: session.id,
						paymentIntent: paymentIntentId(session),
						amountTotal: session.amount_total,
						currency: session.currency,
					},
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

const findPaymentForSession = async (session: SessionFacts) => {
	const bySession = await prisma.payment.findUnique({
		where: { paymentId: session.id },
	});
	if (bySession) return bySession;
	// The webhook can arrive before the session ID is stored on the attempt.
	if (session.client_reference_id) {
		const byReference = await prisma.payment.findUnique({
			where: { id: session.client_reference_id },
		});
		if (byReference?.paymentId.startsWith(PENDING_PREFIX)) return byReference;
	}
	return null;
};

const HANDLED_STRIPE_EVENTS = new Set([
	"checkout.session.completed",
	"checkout.session.async_payment_succeeded",
	"checkout.session.async_payment_failed",
	"checkout.session.expired",
]);

/**
 * Applies one verified Stripe webhook event. The event ID is recorded after a successful
 * run, so a failed run is retried by Stripe and a replay does nothing. Only PENDING payments
 * change: a later expired/failed event can never overwrite COMPLETED.
 */
const handleStripeEvent = async (event: Stripe.Event, ipAddress?: string) => {
	if (!HANDLED_STRIPE_EVENTS.has(event.type)) return { handled: false };
	const seen = await prisma.paymentWebhookEvent.findUnique({
		where: { id: event.id },
	});
	if (seen) return { handled: true, duplicate: true };

	const session = event.data.object as Stripe.Checkout.Session;
	const payment = await findPaymentForSession(session);
	if (!payment) {
		console.error(
			"Stripe webhook for an unknown checkout session:",
			session.id,
		);
	} else if (payment.status === PaymentStatus.PENDING) {
		if (
			event.type === "checkout.session.completed" ||
			event.type === "checkout.session.async_payment_succeeded"
		) {
			// An asynchronous method completes the session before money arrives: wait for the success event.
			if (session.payment_status === "paid") {
				await settlePaidSession(payment, session, ipAddress);
			}
		} else {
			await settlePending(
				payment,
				{
					status: PaymentStatus.FAILED,
					action: "PAYMENT_FAILED",
					reason:
						event.type === "checkout.session.expired"
							? "Checkout session expired"
							: "Payment could not be completed",
				},
				ipAddress,
			);
		}
	}

	try {
		await prisma.paymentWebhookEvent.create({
			data: { id: event.id, type: event.type },
		});
	} catch (error) {
		if ((error as { code?: string }).code !== RACE_ERROR_CODE) throw error;
	}
	return { handled: true, duplicate: false };
};

/**
 * Re-checks a PENDING Stripe payment with Stripe itself (used when a webhook is late or missed).
 * Goes through the same verification as the webhook; a Stripe outage leaves it untouched.
 */
const reconcileStripePayment = async (
	payment: StoredPayment,
	ipAddress?: string,
) => {
	if (
		payment.paymentMethod !== PaymentMethod.STRIPE ||
		payment.status !== PaymentStatus.PENDING ||
		!payment.paymentId.startsWith("cs_")
	) {
		return false;
	}
	let session: Stripe.Checkout.Session;
	try {
		session = await StripeGateway.retrieveCheckoutSession(payment.paymentId);
	} catch {
		return false;
	}
	if (session.payment_status === "paid") {
		await settlePaidSession(payment, session, ipAddress);
		return true;
	}
	if (session.status === "expired") {
		await settlePending(
			payment,
			{
				status: PaymentStatus.FAILED,
				action: "PAYMENT_FAILED",
				reason: "Checkout session expired",
			},
			ipAddress,
		);
		return true;
	}
	return false;
};

const loadAuthorizedPayment = async (
	paymentIdOrRecordId: string,
	userId: string,
	userRole: Role,
) => {
	const payment = await prisma.payment.findFirst({
		where: {
			OR: [{ id: paymentIdOrRecordId }, { paymentId: paymentIdOrRecordId }],
		},
	});
	if (!payment) {
		throw new AppError(httpStatus.NOT_FOUND, "Payment record not found");
	}
	if (userRole !== Role.ADMIN && payment.payerId !== userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to view this payment record",
		);
	}
	return payment;
};

/**
 * The payer leaves Checkout. CANCELLED is recorded only after Stripe confirms the session is
 * unpaid (an open session is expired at Stripe first); a paid session completes instead.
 */
const cancelStripePayment = async (
	paymentIdOrRecordId: string,
	userId: string,
	userRole: Role,
	ipAddress?: string,
) => {
	const payment = await loadAuthorizedPayment(
		paymentIdOrRecordId,
		userId,
		userRole,
	);
	if (payment.status !== PaymentStatus.PENDING) return toOutcomeResult(payment);
	if (
		payment.paymentMethod !== PaymentMethod.STRIPE ||
		!payment.paymentId.startsWith("cs_")
	) {
		return toOutcomeResult(payment);
	}

	try {
		let session = await StripeGateway.retrieveCheckoutSession(
			payment.paymentId,
		);
		if (session.payment_status === "paid") {
			return toOutcomeResult(
				await settlePaidSession(payment, session, ipAddress),
			);
		}
		if (session.status === "open") {
			session = await StripeGateway.expireCheckoutSession(payment.paymentId);
		}
		if (session.status === "expired" && session.payment_status !== "paid") {
			return toOutcomeResult(
				await settlePending(
					payment,
					{ status: PaymentStatus.CANCELLED, action: "PAYMENT_CANCELLED" },
					ipAddress,
				),
			);
		}
		return toOutcomeResult(payment);
	} catch (error) {
		if (error instanceof AppError) throw error;
		throw new AppError(
			httpStatus.BAD_GATEWAY,
			"The payment gateway could not confirm this payment yet. Please try again.",
		);
	}
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
	ipAddress?: string,
) => {
	const load = () =>
		prisma.payment.findFirst({
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

	let payment = await load();
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

	// A late or missed webhook must not strand a paid payment: ask Stripe, verify, settle.
	if (await reconcileStripePayment(payment, ipAddress)) {
		payment = (await load()) ?? payment;
	}
	return payment;
};

export const PaymentService = {
	getMyPayments,
	initiateStripePayment,
	handleStripeEvent,
	cancelStripePayment,
	getPaymentById,
};
