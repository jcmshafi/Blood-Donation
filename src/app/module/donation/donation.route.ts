import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { DonationController } from "./donation.controller";
import { DonationValidation } from "./donation.validation";

const router = Router();

router.get(
	"/my-history",
	auth(Role.DONOR),
	DonationController.getMyDonationHistory,
);

router.patch(
	"/:id/status",
	auth(),
	validateRequest(DonationValidation.updateDonationStatusSchema),
	DonationController.updateDonationStatus,
);

export const DonationRoutes = router;
