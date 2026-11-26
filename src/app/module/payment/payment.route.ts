import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

// Start a Stripe Checkout (test mode) payment
router.post(
	"/stripe/checkout",
	auth(Role.RECIPIENT, Role.ADMIN),
	validateRequest(PaymentValidation.createPaymentSchema),
	PaymentController.initiateStripePayment,
);

// bKash checkout is retired (410); its callback stays until the Stripe webhook replaces it.
router.post("/bkash/create", PaymentController.retiredBkashCreate);

// bKash callback endpoint (accepts POST and GET redirects)
router.post("/bkash/callback", PaymentController.handleBkashCallback);
router.get("/bkash/callback", PaymentController.handleBkashCallback);

// Own payment history. Registered before "/:id" so "mine" is never read as an id.
router.get(
	"/mine",
	auth(Role.RECIPIENT, Role.ADMIN),
	PaymentController.getMyPayments,
);

// Retrieve payment status and transaction details
router.get("/:id", auth(), PaymentController.getPaymentById);

export const PaymentRoutes = router;
