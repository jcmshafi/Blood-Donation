import httpStatus from "http-status";
import { z } from "zod";
import type { Prisma } from "../../../generated/prisma/client";
import { Role } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { publicRequestSelect } from "./bloodRequest.public";

export const workspaceRequestQuerySchema = z.object({}).strict();

export const workspaceRequestSelect = {
	...publicRequestSelect,
	requesterId: true,
	latitude: true,
	longitude: true,
	contactNumber: true,
	notes: true,
	assignments: {
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
		select: {
			id: true,
			donorId: true,
			status: true,
			notes: true,
			completedAt: true,
			createdAt: true,
			updatedAt: true,
			donor: {
				select: {
					id: true,
					name: true,
					phone: true,
					donorProfile: { select: { bloodGroup: true, phone: true } },
				},
			},
		},
	},
} satisfies Prisma.BloodRequestSelect;

export async function getWorkspaceBloodRequest(
	id: string,
	userId: string,
	role: Role,
) {
	if (role !== Role.RECIPIENT && role !== Role.ADMIN) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Workspace access is not permitted",
		);
	}
	// Authorize in the query itself: no private read or shared cache before scope.
	const result = await prisma.bloodRequest.findFirst({
		where: {
			id,
			isDeleted: false,
			...(role === Role.ADMIN ? {} : { requesterId: userId }),
		},
		select: workspaceRequestSelect,
	});
	if (!result)
		throw new AppError(httpStatus.NOT_FOUND, "Blood request not found");
	return result;
}
