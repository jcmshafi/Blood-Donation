import httpStatus from "http-status";
import type { Prisma } from "../../../generated/prisma/client";
import {
	BloodGroup,
	DonationStatus,
	RequestStatus,
	Role,
} from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import type {
	IAcceptBloodRequestPayload,
	IMatchingDonorItem,
	IMatchingDonorsQuery,
	IMatchingDonorsResponse,
	IUpdateDonationStatusPayload,
} from "./donation.interface";

// Standard biological compatibility matrix (Recipient -> Compatible Donors)
export const BLOOD_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
	[BloodGroup.A_POSITIVE]: [
		BloodGroup.A_POSITIVE,
		BloodGroup.A_NEGATIVE,
		BloodGroup.O_POSITIVE,
		BloodGroup.O_NEGATIVE,
	],
	[BloodGroup.A_NEGATIVE]: [BloodGroup.A_NEGATIVE, BloodGroup.O_NEGATIVE],
	[BloodGroup.B_POSITIVE]: [
		BloodGroup.B_POSITIVE,
		BloodGroup.B_NEGATIVE,
		BloodGroup.O_POSITIVE,
		BloodGroup.O_NEGATIVE,
	],
	[BloodGroup.B_NEGATIVE]: [BloodGroup.B_NEGATIVE, BloodGroup.O_NEGATIVE],
	[BloodGroup.AB_POSITIVE]: [
		BloodGroup.A_POSITIVE,
		BloodGroup.A_NEGATIVE,
		BloodGroup.B_POSITIVE,
		BloodGroup.B_NEGATIVE,
		BloodGroup.AB_POSITIVE,
		BloodGroup.AB_NEGATIVE,
		BloodGroup.O_POSITIVE,
		BloodGroup.O_NEGATIVE,
	],
	[BloodGroup.AB_NEGATIVE]: [
		BloodGroup.AB_NEGATIVE,
		BloodGroup.A_NEGATIVE,
		BloodGroup.B_NEGATIVE,
		BloodGroup.O_NEGATIVE,
	],
	[BloodGroup.O_POSITIVE]: [BloodGroup.O_POSITIVE, BloodGroup.O_NEGATIVE],
	[BloodGroup.O_NEGATIVE]: [BloodGroup.O_NEGATIVE],
};

/**
 * Calculates geographical distance between two lat/lon coordinates in kilometers
 * using the Haversine formula.
 */
export const calculateDistanceKm = (
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number => {
	const R = 6371; // Earth's radius in kilometers
	const dLat = (lat2 - lat1) * (Math.PI / 180);
	const dLon = (lon2 - lon1) * (Math.PI / 180);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1 * (Math.PI / 180)) *
			Math.cos(lat2 * (Math.PI / 180)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return Math.round(R * c * 100) / 100; // rounded to 2 decimal places
};

const getMatchingDonors = async (
	requestId: string,
	query: IMatchingDonorsQuery,
): Promise<IMatchingDonorsResponse> => {
	const bloodRequest = await prisma.bloodRequest.findUnique({
		where: { id: requestId, isDeleted: false },
	});

	if (!bloodRequest) {
		throw new AppError(httpStatus.NOT_FOUND, "Blood request not found");
	}

	const reqBloodGroup = bloodRequest.bloodGroup as BloodGroup;
	const compatibleGroups = BLOOD_COMPATIBILITY[reqBloodGroup];
	const now = new Date();
	const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

	// Fetch active eligible donors with compatible blood group who passed cooldown
	const candidateProfiles = await prisma.donorProfile.findMany({
		where: {
			isAvailable: true,
			bloodGroup: { in: compatibleGroups },
			OR: [
				{ lastDonationDate: null },
				{ lastDonationDate: { lte: ninetyDaysAgo } },
			],
			user: {
				status: "ACTIVE",
				isDeleted: false,
				id: { not: bloodRequest.requesterId },
			},
		},
		include: {
			user: {
				select: {
					id: true,
					name: true,
					email: true,
					phone: true,
				},
			},
		},
	});

	// Compute Haversine distance and cooldown metrics
	const mappedDonors: IMatchingDonorItem[] = candidateProfiles.map(
		(profile: (typeof candidateProfiles)[number]) => {
			let distanceKm: number | null = null;
			if (
				profile.latitude !== null &&
				profile.latitude !== undefined &&
				profile.longitude !== null &&
				profile.longitude !== undefined &&
				bloodRequest.latitude !== null &&
				bloodRequest.longitude !== null
			) {
				distanceKm = calculateDistanceKm(
					bloodRequest.latitude,
					bloodRequest.longitude,
					profile.latitude,
					profile.longitude,
				);
			}

			const daysSinceLastDonation = profile.lastDonationDate
				? Math.floor(
						(now.getTime() - profile.lastDonationDate.getTime()) /
							(24 * 60 * 60 * 1000),
					)
				: null;

			return {
				donorProfileId: profile.id,
				donorUserId: profile.userId,
				name: profile.user.name,
				email: profile.user.email,
				phone: profile.phone || profile.user.phone,
				bloodGroup: profile.bloodGroup as BloodGroup | null,
				address: profile.address,
				latitude: profile.latitude,
				longitude: profile.longitude,
				distanceKm,
				isAvailable: profile.isAvailable,
				lastDonationDate: profile.lastDonationDate,
				totalDonations: profile.totalDonations,
				daysSinceLastDonation,
			};
		},
	);

	// Apply optional max distance filter if specified
	let filteredDonors = mappedDonors;
	if (query.maxDistanceKm !== undefined && query.maxDistanceKm > 0) {
		filteredDonors = filteredDonors.filter(
			(donor) =>
				donor.distanceKm !== null && donor.distanceKm <= query.maxDistanceKm!,
		);
	}

	// Sort donors: closest first, unmapped coordinates at the end
	filteredDonors.sort((a, b) => {
		if (a.distanceKm !== null && b.distanceKm !== null) {
			return a.distanceKm - b.distanceKm;
		}
		if (a.distanceKm !== null) return -1;
		if (b.distanceKm !== null) return 1;
		return 0;
	});

	return {
		bloodRequest: {
			id: bloodRequest.id,
			patientName: bloodRequest.patientName,
			bloodGroup: bloodRequest.bloodGroup,
			unitsNeeded: bloodRequest.unitsNeeded,
			unitsFulfilled: bloodRequest.unitsFulfilled,
			hospitalName: bloodRequest.hospitalName,
			hospitalAddress: bloodRequest.hospitalAddress,
			urgency: bloodRequest.urgency,
			status: bloodRequest.status,
		},
		compatibleBloodGroups: compatibleGroups,
		totalMatchingDonors: filteredDonors.length,
		donors: filteredDonors,
	};
};

const acceptBloodRequest = async (
	requestId: string,
	donorUserId: string,
	payload: IAcceptBloodRequestPayload,
) => {
	// 1. Validate donor's profile existence, availability, and cooldown
	const donorProfile = await prisma.donorProfile.findUnique({
		where: { userId: donorUserId },
	});

	if (!donorProfile) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You must set up your donor profile before accepting blood requests.",
		);
	}

	if (!donorProfile.isAvailable) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"You are currently marked as unavailable for donations.",
		);
	}

	if (donorProfile.lastDonationDate) {
		const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
		if (donorProfile.lastDonationDate > ninetyDaysAgo) {
			const daysSince = Math.floor(
				(Date.now() - donorProfile.lastDonationDate.getTime()) /
					(24 * 60 * 60 * 1000),
			);
			const daysRemaining = 90 - daysSince;
			throw new AppError(
				httpStatus.BAD_REQUEST,
				`Medical cooldown in effect: You last donated blood ${daysSince} days ago. You must wait ${daysRemaining} more days before donating again.`,
			);
		}
	}

	// 2. ACID Transaction with concurrency lock to avoid race conditions
	const assignment = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		const bloodRequest = await tx.bloodRequest.findUnique({
			where: { id: requestId, isDeleted: false },
		});

		if (!bloodRequest) {
			throw new AppError(httpStatus.NOT_FOUND, "Blood request not found");
		}

		if (bloodRequest.requesterId === donorUserId) {
			throw new AppError(
				httpStatus.BAD_REQUEST,
				"You cannot accept your own blood request.",
			);
		}

		// Biological compatibility check
		if (donorProfile.bloodGroup) {
			const reqBloodGroup = bloodRequest.bloodGroup as BloodGroup;
			const compatible = BLOOD_COMPATIBILITY[reqBloodGroup];
			const donorBloodGroup = donorProfile.bloodGroup as BloodGroup;
			if (!compatible.includes(donorBloodGroup)) {
				throw new AppError(
					httpStatus.BAD_REQUEST,
					`Your blood group (${donorProfile.bloodGroup}) is not biologically compatible with this request (${bloodRequest.bloodGroup}).`,
				);
			}
		}

		// State & Concurrency validation: Request must not be already fulfilled or closed
		if (
			bloodRequest.status === RequestStatus.FULFILLED ||
			bloodRequest.status === RequestStatus.CANCELLED ||
			bloodRequest.unitsFulfilled >= bloodRequest.unitsNeeded
		) {
			throw new AppError(
				httpStatus.CONFLICT,
				"This blood request has already been fulfilled or closed by other donors.",
			);
		}

		// Check if donor is already assigned to this request
		const existingAssignment = await tx.donationAssignment.findUnique({
			where: {
				requestId_donorId: {
					requestId,
					donorId: donorUserId,
				},
			},
		});

		if (existingAssignment) {
			if (existingAssignment.status !== DonationStatus.CANCELLED) {
				throw new AppError(
					httpStatus.CONFLICT,
					"You have already accepted this blood request.",
				);
			}

			// Reactivate previously cancelled assignment
			const nextUnits = bloodRequest.unitsFulfilled + 1;
			const nextStatus =
				nextUnits >= bloodRequest.unitsNeeded
					? RequestStatus.FULFILLED
					: RequestStatus.MATCHED;

			await tx.bloodRequest.update({
				where: { id: requestId },
				data: {
					unitsFulfilled: nextUnits,
					status: nextStatus,
				},
			});

			return tx.donationAssignment.update({
				where: { id: existingAssignment.id },
				data: {
					status: DonationStatus.ASSIGNED,
					notes: payload.notes || existingAssignment.notes,
					completedAt: null,
				},
				include: {
					request: true,
					donor: {
						select: {
							id: true,
							name: true,
							email: true,
							phone: true,
						},
					},
				},
			});
		}

		// Increment units fulfilled and transition request status
		const nextUnits = bloodRequest.unitsFulfilled + 1;
		const nextStatus =
			nextUnits >= bloodRequest.unitsNeeded
				? RequestStatus.FULFILLED
				: RequestStatus.MATCHED;

		await tx.bloodRequest.update({
			where: { id: requestId },
			data: {
				unitsFulfilled: nextUnits,
				status: nextStatus,
			},
		});

		// Create donation assignment record
		return tx.donationAssignment.create({
			data: {
				requestId,
				donorId: donorUserId,
				status: DonationStatus.ASSIGNED,
				notes: payload.notes,
			},
			include: {
				request: true,
				donor: {
					select: {
						id: true,
						name: true,
						email: true,
						phone: true,
					},
				},
			},
		});
	});

	return assignment;
};

const updateDonationStatus = async (
	assignmentId: string,
	userId: string,
	userRole: Role,
	payload: IUpdateDonationStatusPayload,
) => {
	const assignment = await prisma.donationAssignment.findUnique({
		where: { id: assignmentId },
		include: {
			request: true,
		},
	});

	if (!assignment) {
		throw new AppError(httpStatus.NOT_FOUND, "Donation assignment not found");
	}

	// Verify authorization: donor, requester, or admin
	const isDonor = assignment.donorId === userId;
	const isRequester = assignment.request.requesterId === userId;
	const isAdmin = userRole === Role.ADMIN;

	if (!isDonor && !isRequester && !isAdmin) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You do not have permission to update this donation assignment.",
		);
	}

	if (assignment.status === DonationStatus.COMPLETED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Donation assignment has already been completed and cannot be modified.",
		);
	}

	if (assignment.status === DonationStatus.CANCELLED) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Donation assignment has already been cancelled and cannot be modified.",
		);
	}

	const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
		if (payload.status === DonationStatus.COMPLETED) {
			const completedAssignment = await tx.donationAssignment.update({
				where: { id: assignmentId },
				data: {
					status: DonationStatus.COMPLETED,
					completedAt: new Date(),
					notes: payload.notes || assignment.notes,
				},
				include: {
					request: true,
					donor: {
						select: {
							id: true,
							name: true,
							email: true,
							phone: true,
						},
					},
				},
			});

			// Atomically update donor's profile: lastDonationDate, totalDonations, isAvailable
			await tx.donorProfile.update({
				where: { userId: assignment.donorId },
				data: {
					lastDonationDate: new Date(),
					totalDonations: { increment: 1 },
					isAvailable: false, // 90-day cooldown commences
				},
			});

			return completedAssignment;
		}

		if (payload.status === DonationStatus.CANCELLED) {
			const cancelledAssignment = await tx.donationAssignment.update({
				where: { id: assignmentId },
				data: {
					status: DonationStatus.CANCELLED,
					notes: payload.notes || assignment.notes,
				},
				include: {
					request: true,
					donor: {
						select: {
							id: true,
							name: true,
							email: true,
							phone: true,
						},
					},
				},
			});

			// Roll back fulfilled units and status on the blood request
			const currentUnits = assignment.request.unitsFulfilled;
			const nextUnits = Math.max(0, currentUnits - 1);
			const nextStatus =
				nextUnits === 0 ? RequestStatus.OPEN : RequestStatus.MATCHED;

			await tx.bloodRequest.update({
				where: { id: assignment.requestId },
				data: {
					unitsFulfilled: nextUnits,
					status: nextStatus,
				},
			});

			return cancelledAssignment;
		}

		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Invalid target donation status.",
		);
	});

	return updated;
};

const getMyDonationHistory = async (donorUserId: string) => {
	const donorProfile = await prisma.donorProfile.findUnique({
		where: { userId: donorUserId },
	});

	const assignments = await prisma.donationAssignment.findMany({
		where: { donorId: donorUserId },
		include: {
			request: {
				select: {
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
				},
			},
		},
		orderBy: { createdAt: "desc" },
	});

	const now = new Date();
	const lastDonationDate = donorProfile?.lastDonationDate || null;
	let nextEligibleDate: Date | null = null;
	let isEligibleNow = true;
	let daysUntilEligible = 0;

	if (lastDonationDate) {
		const eligibleTime = lastDonationDate.getTime() + 90 * 24 * 60 * 60 * 1000;
		nextEligibleDate = new Date(eligibleTime);
		if (now.getTime() < eligibleTime) {
			isEligibleNow = false;
			daysUntilEligible = Math.ceil(
				(eligibleTime - now.getTime()) / (24 * 60 * 60 * 1000),
			);
		}
	}

	const totalAssigned = assignments.length;
	const totalCompleted = assignments.filter(
		(a: (typeof assignments)[number]) => a.status === DonationStatus.COMPLETED,
	).length;
	const totalCancelled = assignments.filter(
		(a: (typeof assignments)[number]) => a.status === DonationStatus.CANCELLED,
	).length;
	const totalActive = assignments.filter(
		(a: (typeof assignments)[number]) => a.status === DonationStatus.ASSIGNED,
	).length;

	return {
		summary: {
			totalDonations: donorProfile?.totalDonations || totalCompleted,
			totalAssigned,
			totalCompleted,
			totalCancelled,
			totalActive,
			isAvailable: donorProfile?.isAvailable ?? false,
			lastDonationDate,
			nextEligibleDate,
			isEligibleNow,
			daysUntilEligible,
		},
		donations: assignments,
	};
};

export const DonationService = {
	getMatchingDonors,
	acceptBloodRequest,
	updateDonationStatus,
	getMyDonationHistory,
};
