import { Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { UserValidation } from "./user.validation";

const router = Router();

router.get("/me", auth(), UserController.getMyProfile);

router.patch(
	"/me",
	auth(),
	validateRequest(UserValidation.updateProfileValidationSchema),
	UserController.updateMyProfile,
);

router.patch(
	"/donor-profile",
	auth(Role.DONOR),
	validateRequest(UserValidation.updateDonorProfileValidationSchema),
	UserController.updateDonorProfile,
);

export const UserRoutes = router;
