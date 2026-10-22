import httpStatus from "http-status";
import { Role } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { cache } from "../../lib/redis";
import { AppError } from "../../utils/AppError";
import type {
	IUpdateDonorProfilePayload,
	IUpdateUserProfilePayload,
} from "./user.interface";

const getMyProfile = async (userId: string) => {
	const user = await prisma.user.findUnique({
		where: { id: userId, isDeleted: false },
		include: {
			donorProfile: true,
		},
		omit: {
			password: true,
		},
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User profile not found");
	}

	return user;
};

const updateMyProfile = async (
	userId: string,
	payload: IUpdateUserProfilePayload,
) => {
	const user = await prisma.user.findUnique({
		where: { id: userId, isDeleted: false },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User profile not found");
	}

	const updatedUser = await prisma.user.update({
		where: { id: userId },
		data: {
			...(payload.name !== undefined && { name: payload.name }),
			...(payload.phone !== undefined && { phone: payload.phone }),
			...(payload.address !== undefined && { address: payload.address }),
		},
		include: {
			donorProfile: true,
		},
		omit: {
			password: true,
		},
	});

	return updatedUser;
};

const updateDonorProfile = async (
	userId: string,
	payload: IUpdateDonorProfilePayload,
) => {
	const user = await prisma.user.findUnique({
		where: { id: userId, isDeleted: false },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User not found");
	}

	if (user.role !== Role.DONOR) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only donors can manage a donor profile",
		);
	}

	const parsedDate =
		payload.lastDonationDate !== undefined
			? payload.lastDonationDate
				? new Date(payload.lastDonationDate)
				: null
			: undefined;

	const updateData = {
		...(payload.bloodGroup !== undefined && { bloodGroup: payload.bloodGroup }),
		...(payload.isAvailable !== undefined && { isAvailable: payload.isAvailable }),
		...(parsedDate !== undefined && { lastDonationDate: parsedDate }),
		...(payload.phone !== undefined && { phone: payload.phone }),
		...(payload.address !== undefined && { address: payload.address }),
		...(payload.latitude !== undefined && { latitude: payload.latitude }),
		...(payload.longitude !== undefined && { longitude: payload.longitude }),
	};

	const updatedDonorProfile = await prisma.donorProfile.upsert({
		where: { userId },
		update: updateData,
		create: {
			userId,
			...updateData,
		},
	});

	// Invalidate matching donors and dashboard caches
	await Promise.all([
		cache.delByPattern("cache:matching-donors:*"),
		cache.del("cache:admin:dashboard-stats"),
	]);

	return updatedDonorProfile;
};

export const UserService = {
	getMyProfile,
	updateMyProfile,
	updateDonorProfile,
};
