import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { adminUsersQuerySchema, auditLogsQuerySchema } from "./admin.query";
import { AdminService } from "./admin.service";

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
	res.setHeader("Cache-Control", "private, no-store");
	const filters = adminUsersQuerySchema.parse(req.query);
	const result = await AdminService.getAllUsers(filters);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Users retrieved successfully",
		data: result,
	});
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
	const adminUserId = req.user!.userId;
	const targetUserId = req.params.id as string;
	const ipAddress = req.ip;

	const result = await AdminService.updateUserStatus(
		adminUserId,
		targetUserId,
		req.body,
		ipAddress,
	);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User status updated successfully",
		data: result,
	});
});

const getDashboardStats = catchAsync(async (_req: Request, res: Response) => {
	const result = await AdminService.getDashboardStats();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Dashboard statistics retrieved successfully",
		data: result,
	});
});

const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
	res.setHeader("Cache-Control", "private, no-store");
	const filters = auditLogsQuerySchema.parse(req.query);
	const result = await AdminService.getAuditLogs(filters);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Audit logs retrieved successfully",
		data: result,
	});
});

export const AdminController = {
	getAllUsers,
	updateUserStatus,
	getDashboardStats,
	getAuditLogs,
};
