import type { NextFunction, Request, Response } from "express";
import httpStatus from "http-status";
import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { AppError } from "../utils/AppError";

type TErrorSource = {
	field?: string;
	message: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const globalErrorHandler = (
	err: any,
	_req: Request,
	res: Response,
	_next: NextFunction,
) => {
	let statusCode: number = httpStatus.INTERNAL_SERVER_ERROR;
	let message = "Something went wrong";
	let errors: TErrorSource[] = [];

	if (err instanceof ZodError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Validation Error";
		errors = err.issues.map((issue) => ({
			field: issue.path.length > 0 ? issue.path.join(".") : undefined,
			message: issue.message,
		}));
	} else if (err instanceof AppError) {
		statusCode = err.statusCode;
		message = err.message;
		errors = [{ message: err.message }];
	} else if (err instanceof Prisma.PrismaClientValidationError) {
		statusCode = httpStatus.BAD_REQUEST;
		message = "Prisma validation error: Invalid field types or missing fields";
		errors = [{ message: err.message }];
	} else if (err instanceof Prisma.PrismaClientKnownRequestError) {
		if (err.code === "P2002") {
			statusCode = httpStatus.CONFLICT;
			message = "Duplicate key error: A record with this value already exists";
			errors = [
				{
					field: (err.meta?.target as string[])?.join(".") || "field",
					message: "Must be unique",
				},
			];
		} else if (err.code === "P2025") {
			statusCode = httpStatus.NOT_FOUND;
			message = "Requested record not found";
			errors = [{ message: "Record not found" }];
		} else if (err.code === "P2003") {
			statusCode = httpStatus.BAD_REQUEST;
			message = "Foreign key constraint failure";
			errors = [{ message: "Foreign key reference failed" }];
		} else {
			statusCode = httpStatus.BAD_REQUEST;
			message = err.message || "Database query error";
			errors = [{ message: err.message }];
		}
	} else if (err instanceof Error) {
		statusCode = httpStatus.BAD_REQUEST;
		message = err.message || "Something went wrong";
		errors = [{ message: err.message }];
	}

	res.status(statusCode).json({
		success: false,
		message,
		errors,
	});
};
