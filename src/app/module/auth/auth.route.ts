import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthController } from "./auth.controller";
import { AuthValidation } from "./auth.validation";

const router = Router();

router.post(
	"/register",
	validateRequest(AuthValidation.registerValidationSchema),
	AuthController.registerUser,
);

router.post(
	"/login",
	validateRequest(AuthValidation.loginValidationSchema),
	AuthController.loginUser,
);

router.post(
	"/google-login",
	validateRequest(AuthValidation.googleLoginValidationSchema),
	AuthController.googleLogin,
);

router.post(
	"/refresh-token",
	validateRequest(AuthValidation.refreshTokenValidationSchema),
	AuthController.refreshToken,
);

router.post("/logout", AuthController.logout);

export const AuthRoutes = router;
