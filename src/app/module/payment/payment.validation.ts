import { z } from "zod";
import {
	formatMinor,
	MAX_AMOUNT_MINOR,
	MIN_AMOUNT_MINOR,
	parseDecimalToMinor,
} from "../../utils/money";

const amountSchema = z
	.union([z.string(), z.number()])
	.transform((value, ctx) => {
		const minor = parseDecimalToMinor(value);
		if (minor === null) {
			ctx.addIssue({
				code: "custom",
				message: `Amount must be a BDT value with at most two decimals between ${formatMinor(MIN_AMOUNT_MINOR)} and ${formatMinor(MAX_AMOUNT_MINOR)}`,
			});
			return z.NEVER;
		}
		return minor;
	});

// Body is strict: payer, status and provider fields are never client-controlled.
const createPaymentSchema = z.object({
	body: z
		.object({
			requestId: z.string().uuid("Valid blood request ID (UUID) is required"),
			amount: amountSchema,
		})
		.strict()
		.transform(({ requestId, amount }) => ({ requestId, amountMinor: amount })),
});

export const idempotencyKeySchema = z
	.string()
	.regex(
		/^[A-Za-z0-9_-]{16,64}$/,
		"Idempotency-Key must be 16-64 characters: letters, digits, '-' or '_'",
	);

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
