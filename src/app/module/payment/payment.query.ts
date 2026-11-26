import { z } from "zod";
import { PaymentStatus } from "../../../generated/prisma/enums";

const positiveInteger = (maximum: number, fallback: number) =>
	z
		.string()
		.regex(/^[1-9]\d*$/)
		.transform(Number)
		.pipe(z.number().int().min(1).max(maximum))
		.default(fallback);

// The only fields a caller can sort by.
export const PAYMENT_SORT_FIELDS = [
	"createdAt",
	"amountMinor",
	"status",
] as const;

// Strict: payerId/userId/anything else is a 400, so the list scope can only come
// from the authenticated session.
export const myPaymentsQuerySchema = z
	.object({
		page: positiveInteger(1000000, 1),
		limit: positiveInteger(50, 10),
		status: z.nativeEnum(PaymentStatus).optional(),
		sortBy: z.enum(PAYMENT_SORT_FIELDS).default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
	})
	.strict();

export type MyPaymentsQuery = z.infer<typeof myPaymentsQuerySchema>;
