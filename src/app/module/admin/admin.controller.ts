import type { Request, Response } from "express";
import httpStatus from "http-status";
import type { Role, UserStatus } from "../../../generated/prisma/enums";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import type {
	IAdminUserFilterOptions,
	IAuditLogFilterOptions,
} from "./admin.interface";
import { AdminService } from "./admin.service";

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
	const filters: IAdminUserFilterOptions = {
		searchTerm: req.query.searchTerm ? String(req.query.searchTerm) : undefined,
		role: req.query.role ? (String(req.query.role) as Role) : undefined,
		status: req.query.status
			? (String(req.query.status) as UserStatus)
			: undefined,
		page: req.query.page ? Number(req.query.page) : 1,
		limit: req.query.limit ? Number(req.query.limit) : 10,
		sortBy: req.query.sortBy ? String(req.query.sortBy) : "createdAt",
		sortOrder: req.query.sortOrder === "asc" ? "asc" : "desc",
	};

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
	const filters: IAuditLogFilterOptions = {
		action: req.query.action ? String(req.query.action) : undefined,
		resource: req.query.resource ? String(req.query.resource) : undefined,
		page: req.query.page ? Number(req.query.page) : 1,
		limit: req.query.limit ? Number(req.query.limit) : 20,
		sortBy: req.query.sortBy ? String(req.query.sortBy) : "createdAt",
		sortOrder: req.query.sortOrder === "asc" ? "asc" : "desc",
	};

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
