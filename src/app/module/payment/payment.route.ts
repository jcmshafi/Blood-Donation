import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { PaymentController } from "./payment.controller";
import { PaymentValidation } from "./payment.validation";

const router = Router();

// Initiate bKash tokenized checkout payment
router.post(
	"/bkash/create",
	auth(Role.RECIPIENT, Role.ADMIN),
	validateRequest(PaymentValidation.createPaymentSchema),
	PaymentController.initiateBkashPayment,
);

// bKash callback endpoint (accepts POST and GET redirects)
router.post("/bkash/callback", PaymentController.handleBkashCallback);
router.get("/bkash/callback", PaymentController.handleBkashCallback);

// Retrieve payment status and transaction details
router.get("/:id", auth(), PaymentController.getPaymentById);

export const PaymentRoutes = router;
