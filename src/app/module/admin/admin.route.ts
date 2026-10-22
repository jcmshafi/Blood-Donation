import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { AdminController } from "./admin.controller";
import { AdminValidation } from "./admin.validation";

const router = Router();

// Endpoint 21: Paginated list of users with search and role filters
router.get(
	"/users",
	auth(Role.ADMIN),
	validateRequest(AdminValidation.userFilterValidationSchema),
	AdminController.getAllUsers,
);

// Endpoint 22: Update user status (ACTIVE / BLOCKED) with audit trail
router.patch(
	"/users/:id/status",
	auth(Role.ADMIN),
	validateRequest(AdminValidation.updateUserStatusValidationSchema),
	AdminController.updateUserStatus,
);

// Endpoint 23: Real-time platform analytics & metrics dashboard
router.get(
	"/dashboard-stats",
	auth(Role.ADMIN),
	AdminController.getDashboardStats,
);

// Endpoint 24: View system-wide compliance and activity audit logs
router.get(
	"/audit-logs",
	auth(Role.ADMIN),
	validateRequest(AdminValidation.auditLogFilterValidationSchema),
	AdminController.getAuditLogs,
);

export const AdminRoutes = router;
