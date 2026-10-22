import rateLimit from "express-rate-limit";
import httpStatus from "http-status";

/**
 * Global rate limiter: 100 requests per 15-minute window per IP.
 * Protects platform against DoS and abusive scraping.
 */
export const globalRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 100,
	standardHeaders: true,
	legacyHeaders: false,
	statusCode: httpStatus.TOO_MANY_REQUESTS,
	message: {
		success: false,
		message:
			"Too many requests from this IP address. Please try again after 15 minutes.",
		errors: [
			{
				message: "Rate limit exceeded. Maximum 100 requests per 15 minutes.",
			},
		],
	},
});

/**
 * Strict authentication rate limiter: 25 attempts per 15-minute window per IP.
 * Protects login and registration routes against credential stuffing and brute-force attacks.
 */
export const authRateLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 25,
	standardHeaders: true,
	legacyHeaders: false,
	statusCode: httpStatus.TOO_MANY_REQUESTS,
	message: {
		success: false,
		message:
			"Too many authentication attempts. Please try again after 15 minutes.",
		errors: [
			{
				message:
					"Authentication rate limit exceeded to protect against brute-force attacks.",
			},
		],
	},
});
