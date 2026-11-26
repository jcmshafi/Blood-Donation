import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const sandboxDefault = (value: string) =>
	process.env.NODE_ENV === "production" ? "" : value;

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
	// bKash's published sandbox demo credentials are used only outside production, so a
	// production deploy that forgets to set BKASH_* answers 503 instead of using the sandbox.
	bkash_app_key:
		process.env.BKASH_APP_KEY || sandboxDefault("4f6o0cjiki2rfm34kfdadl1eqq"),
	bkash_app_secret:
		process.env.BKASH_APP_SECRET ||
		sandboxDefault("2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b"),
	bkash_username:
		process.env.BKASH_USERNAME || sandboxDefault("sandboxTokenizedUser02"),
	bkash_password:
		process.env.BKASH_PASSWORD ||
		sandboxDefault("sandboxTokenizedUser02@12345"),
	bkash_base_url:
		process.env.BKASH_BASE_URL ||
		"https://tokenized.sandbox.bka.sh/v1.2.0-beta",
	bkash_callback_url:
		process.env.BKASH_CALLBACK_URL ||
		"http://localhost:5000/api/v1/payments/bkash/callback",
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
