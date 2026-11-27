import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
	node_env: process.env.NODE_ENV,
	port: process.env.PORT,
	database_url: process.env.DATABASE_URL,
	bak_url: process.env.APP_URL,
	frontend_url: process.env.FRONTEND_URL,
	bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
	jwt_access_secret:
		process.env.JWT_ACCESS_SECRET ||
		"default_jwt_access_secret_for_emergency_platform",
	jwt_refresh_secret:
		process.env.JWT_REFRESH_SECRET ||
		"default_jwt_refresh_secret_for_emergency_platform",
	jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN || "1d",
	jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
	// Stripe runs in test mode only (sk_test_ keys); initiation answers 503 until a test key is set.
	stripe_secret_key: process.env.STRIPE_SECRET_KEY || "",
	stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || "",
	stripe_currency: (process.env.STRIPE_CURRENCY || "bdt").toLowerCase(),
	// Test-only override of the Stripe API origin (a local stand-in server).
	stripe_api_base_url: process.env.STRIPE_API_BASE_URL || "",
	google_client_id: process.env.GOOGLE_CLIENT_ID,
	email_user: process.env.EMAIL_USER,
	google_app_password: process.env.GOOGLE_APP_PASSWORD,
};
