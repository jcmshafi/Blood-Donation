import { z } from "zod";

const createPaymentSchema = z.object({
	body: z.object({
		requestId: z.string().uuid("Valid blood request ID (UUID) is required"),
		amount: z.number().positive("Payment amount must be a positive number"),
	}),
});

const bkashCallbackSchema = z.object({
	body: z.object({
		paymentID: z.string().min(1, "paymentID is required"),
		status: z.string().optional(),
	}),
});

export const PaymentValidation = {
	createPaymentSchema,
	bkashCallbackSchema,
};
