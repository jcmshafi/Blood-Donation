import type { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../lib/prisma";
import {
	publicRequestQuerySchema,
	publicRequestSelect,
} from "./bloodRequest.public";

// Same strict allowlist as discovery: caller-supplied identity keys are rejected.
export const ownedRequestQuerySchema = publicRequestQuerySchema;

export async function getOwnedBloodRequests(
	requesterId: string,
	filters: z.infer<typeof ownedRequestQuerySchema>,
) {
	const {
		page,
		limit,
		searchTerm,
		bloodGroup,
		urgency,
		status,
		sortBy,
		sortOrder,
	} = filters;
	const ownerScope = { requesterId, isDeleted: false };
	const where: Prisma.BloodRequestWhereInput = {
		...ownerScope,
		...(bloodGroup ? { bloodGroup } : {}),
		...(urgency ? { urgency } : {}),
		...(status ? { status } : {}),
		...(searchTerm
			? {
					OR: [
						{ patientName: { contains: searchTerm, mode: "insensitive" } },
						{ hospitalName: { contains: searchTerm, mode: "insensitive" } },
						{ hospitalAddress: { contains: searchTerm, mode: "insensitive" } },
					],
				}
			: {}),
	};

	// Keep page totals and global summary consistent during concurrent updates.
	// Never reuse the anonymous cache or cache one owner's results for another.
	return prisma.$transaction(
		async (tx) => {
			const total = await tx.bloodRequest.count({ where });
			const result = await tx.bloodRequest.findMany({
				where,
				skip: (page - 1) * limit,
				take: limit,
				orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
				select: publicRequestSelect,
			});
			const groups = await tx.bloodRequest.groupBy({
				by: ["status"],
				where: ownerScope,
				_count: { _all: true },
			});
			const summary = {
				total: 0,
				open: 0,
				matched: 0,
				fulfilled: 0,
				cancelled: 0,
			};
			for (const group of groups) {
				const count = group._count._all;
				summary.total += count;
				switch (group.status) {
					case "OPEN":
						summary.open = count;
						break;
					case "MATCHED":
						summary.matched = count;
						break;
					case "FULFILLED":
						summary.fulfilled = count;
						break;
					case "CANCELLED":
						summary.cancelled = count;
						break;
				}
			}
			return {
				meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
				result,
				summary,
			};
		},
		{ isolationLevel: "RepeatableRead" },
	);
}
