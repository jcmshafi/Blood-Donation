import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { BloodRequestController } from "./bloodRequest.controller";
import { BloodRequestValidation } from "./bloodRequest.validation";

const router = Router();

router.post(
	"/",
	auth(Role.RECIPIENT, Role.ADMIN),
	validateRequest(BloodRequestValidation.createBloodRequestSchema),
	BloodRequestController.createBloodRequest,
);

router.get("/", BloodRequestController.getAllBloodRequests);

router.get("/:id", BloodRequestController.getBloodRequestById);

router.patch(
	"/:id",
	auth(),
	validateRequest(BloodRequestValidation.updateBloodRequestSchema),
	BloodRequestController.updateBloodRequest,
);

router.delete("/:id", auth(), BloodRequestController.deleteBloodRequest);

export const BloodRequestRoutes = router;
