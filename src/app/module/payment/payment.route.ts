import express, { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

/** Raw body parser for the webhook path. Mount before express.json() so the signature can be verified. */
export const stripeWebhookBodyParser = express.raw({
	type: "application/json",
	limit: "1mb",
});

const router = Router();

// Start a Stripe Checkout (test mode) payment
router.post(
	"/stripe/checkout",
	auth(Role.RECIPIENT, Role.ADMIN),
	validateRequest(PaymentValidation.createPaymentSchema),
	PaymentController.initiateStripePayment,
);

// bKash checkout is retired (410); old bKash records stay readable through GET /:id and /mine.
router.post("/bkash/create", PaymentController.retiredBkashCreate);

// Stripe webhook: unauthenticated, signature-verified, raw body (parser mounted in app.ts).
router.post("/stripe/webhook", PaymentController.handleStripeWebhook);

// Own payment history. Registered before "/:id" so "mine" is never read as an id.
router.get(
	"/mine",
	auth(Role.RECIPIENT, Role.ADMIN),
	PaymentController.getMyPayments,
);

// The payer leaves Checkout: Stripe confirms the session is unpaid before CANCELLED is recorded.
router.post("/:id/cancel", auth(), PaymentController.cancelStripePayment);

// Retrieve payment status and transaction details
router.get("/:id", auth(), PaymentController.getPaymentById);

export const PaymentRoutes = router;
