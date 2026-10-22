import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
	type Application,
	type Request,
	type Response,
} from "express";
import helmet from "helmet";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { globalRateLimiter } from "./app/middleware/rateLimiter";
import { AdminRoutes } from "./app/module/admin/admin.route";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { BloodRequestRoutes } from "./app/module/bloodRequest/bloodRequest.route";
import { DonationRoutes } from "./app/module/donation/donation.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { UserRoutes } from "./app/module/user/user.route";

const app: Application = express();

// Security headers with Helmet
app.use(
	helmet({
		crossOriginResourcePolicy: { policy: "cross-origin" },
	}),
);

// Global API Rate Limiter (100 requests / 15 minutes)
app.use(globalRateLimiter);

app.use(
	cors({
		origin: config.frontend_url || "*",
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

// Route definitions
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/users", UserRoutes);
app.use("/api/v1/blood-requests", BloodRequestRoutes);
app.use("/api/v1/donations", DonationRoutes);
app.use("/api/v1/payments", PaymentRoutes);
app.use("/api/v1/admin", AdminRoutes);

// Root Health check endpoint
app.get("/", (_req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to Blood Donation & Emergency Platform Backend API",
		data: {
			version: "v1.0.0",
			status: "active",
			docs: "Import postman collections from ./postman/ to test each phase",
		},
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
