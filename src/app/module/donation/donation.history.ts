import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client";
import { DonationStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";

const positiveInteger = (maximum: number, fallback: number) =>
	z
		.string()
		.regex(/^[1-9]\d*$/)
		.transform(Number)
		.pipe(z.number().int().min(1).max(maximum))
		.default(fallback);

// Parsed straight from req.query: unknown keys (donorId/userId), repeated
// values and invalid values are rejected before any database access.
export const donationHistoryQuerySchema = z
	.object({
		status: z.nativeEnum(DonationStatus).optional(),
		page: positiveInteger(1000000, 1),
		limit: positiveInteger(100, 10),
		sortBy: z.enum(["createdAt", "updatedAt", "completedAt"]).default("createdAt"),
		sortOrder: z.enum(["asc", "desc"]).default("desc"),
	})
	.strict();

const DAY_MS = 24 * 60 * 60 * 1000;

const requestSelect = {
	id: true,
	patientName: true,
	bloodGroup: true,
	unitsNeeded: true,
	unitsFulfilled: true,
	hospitalName: true,
	hospitalAddress: true,
	urgency: true,
	status: true,
	createdAt: true,
} satisfies Prisma.BloodRequestSelect;

export async function getDonationHistory(
	donorUserId: string,
	filters: z.infer<typeof donationHistoryQuerySchema>,
) {
	const { status, page, limit, sortBy, sortOrder } = filters;
	// Identity always comes from the verified session, never from the query.
	const ownerScope = { donorId: donorUserId };
	const where: Prisma.DonationAssignmentWhereInput = {
		...ownerScope,
		...(status ? { status } : {}),
	};

	// One consistent snapshot so page, totals and summary agree under writes.
	const snapshot = await prisma.$transaction(
		async (tx) => {
			const donorProfile = await tx.donorProfile.findUnique({
				where: { userId: donorUserId },
			});
			const total = await tx.donationAssignment.count({ where });
			const donations = await tx.donationAssignment.findMany({
				where,
				skip: (page - 1) * limit,
				take: limit,
				// Nullable completedAt sorts last; id is the stable tie breaker.
				orderBy: [
					sortBy === "completedAt"
						? { completedAt: { sort: sortOrder, nulls: "last" } }
						: { [sortBy]: sortOrder },
					{ id: "asc" },
				],
				include: { request: { select: requestSelect } },
			});
			const groups = await tx.donationAssignment.groupBy({
				by: ["status"],
				where: ownerScope,
				_count: { _all: true },
			});
			return { donorProfile, total, donations, groups };
		},
		{ isolationLevel: "RepeatableRead" },
	);

	const counts = { ASSIGNED: 0, COMPLETED: 0, CANCELLED: 0 };
	for (const group of snapshot.groups) {
		counts[group.status] = group._count._all;
	}
	const totalAssigned = counts.ASSIGNED + counts.COMPLETED + counts.CANCELLED;

	const now = new Date();
	const lastDonationDate = snapshot.donorProfile?.lastDonationDate ?? null;
	let nextEligibleDate: Date | null = null;
	let isEligibleNow = true;
	let daysUntilEligible = 0;
	if (lastDonationDate) {
		const eligibleTime = lastDonationDate.getTime() + 90 * DAY_MS;
		nextEligibleDate = new Date(eligibleTime);
		if (now.getTime() < eligibleTime) {
			isEligibleNow = false;
			daysUntilEligible = Math.ceil((eligibleTime - now.getTime()) / DAY_MS);
		}
	}

	return {
		meta: {
			page,
			limit,
			total: snapshot.total,
			totalPages: Math.ceil(snapshot.total / limit),
		},
		// Summary counts every assignment the donor owns, independent of
		// the status filter and the current page.
		summary: {
			totalDonations: snapshot.donorProfile?.totalDonations || counts.COMPLETED,
			totalAssigned,
			totalCompleted: counts.COMPLETED,
			totalCancelled: counts.CANCELLED,
			totalActive: counts.ASSIGNED,
			isAvailable: snapshot.donorProfile?.isAvailable ?? false,
			lastDonationDate,
			nextEligibleDate,
			isEligibleNow,
			daysUntilEligible,
		},
		donations: snapshot.donations,
	};
}
