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
	jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
	jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
	jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN!,
	jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,
	bkash_app_key: process.env.BKASH_APP_KEY || "4f6o0cjiki2rfm34kfdadl1eqq",
	bkash_app_secret:
		process.env.BKASH_APP_SECRET ||
		"2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b",
	bkash_username: process.env.BKASH_USERNAME || "sandboxTokenizedUser02",
	bkash_password: process.env.BKASH_PASSWORD || "sandboxTokenizedUser02@12345",
	bkash_base_url:
		process.env.BKASH_BASE_URL ||
		"https://tokenized.sandbox.bka.sh/v1.2.0-beta",
	bkash_callback_url:
		process.env.BKASH_CALLBACK_URL ||
		"http://localhost:5000/api/v1/payments/bkash/callback",
};
