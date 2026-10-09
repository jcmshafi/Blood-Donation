import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import type { JwtPayload } from "jsonwebtoken";
import type { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/AppError";
import { catchAsync } from "../utils/catchAsync";
import { jwtUtils } from "../utils/jwt";

declare global {
	namespace Express {
		interface Request {
			user?: {
				userId: string;
				email: string;
				name: string;
				role: Role;
			};
		}
	}
}

export const auth = (...requiredRoles: Role[]) => {
	return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
		const token = req.cookies.accessToken
			? req.cookies.accessToken
			: req.headers.authorization?.startsWith("Bearer ")
				? req.headers.authorization.split(" ")[1]
				: req.headers.authorization;

		if (!token) {
			throw new AppError(
				httpStatus.UNAUTHORIZED,
				"You are not logged in. Please log in to access this resource.",
			);
		}

		const verifiedToken = jwtUtils.verifyToken(token, config.jwt_access_secret);

		if (!verifiedToken.success) {
			throw new AppError(httpStatus.UNAUTHORIZED, "Invalid or expired access token");
		}

		const { userId, email, name, role } = verifiedToken.data as JwtPayload;

		const user = await prisma.user.findUnique({
			where: { id: userId },
		});

		if (!user || user.isDeleted) {
			throw new AppError(httpStatus.UNAUTHORIZED, "User account not found or deleted");
		}

		if (user.status === "BLOCKED") {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Your account has been suspended by administration",
			);
		}

		if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
			throw new AppError(
				httpStatus.FORBIDDEN,
				"Forbidden. You do not have permission to perform this action",
			);
		}

		req.user = {
			userId: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
		};

		next();
	});
};
