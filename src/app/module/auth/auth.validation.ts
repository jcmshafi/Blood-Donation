import { z } from "zod";
import { BloodGroup, Role } from "../../../generated/prisma/enums";

const registerValidationSchema = z.object({
	body: z.object({
		name: z.string().min(2, "Name must be at least 2 characters"),
		email: z.string().email("Invalid email format"),
		password: z.string().min(6, "Password must be at least 6 characters"),
		role: z
			.enum([Role.DONOR, Role.RECIPIENT], {
				error: "Role must be either DONOR or RECIPIENT",
			})
			.default(Role.RECIPIENT),
		phone: z.string().optional(),
		address: z.string().optional(),
		bloodGroup: z.nativeEnum(BloodGroup).optional(),
		latitude: z.number().optional(),
		longitude: z.number().optional(),
	}),
});

const loginValidationSchema = z.object({
	body: z.object({
		email: z.string().email("Invalid email format"),
		password: z.string().min(1, "Password is required"),
	}),
});

const googleLoginValidationSchema = z.object({
	body: z.object({
		idToken: z.string().min(1, "Google ID token is required"),
		role: z.enum([Role.DONOR, Role.RECIPIENT]).optional().default(Role.RECIPIENT),
	}),
});

const refreshTokenValidationSchema = z.object({
	body: z
		.object({
			refreshToken: z.string().optional(),
		})
		.optional(),
	cookies: z
		.object({
			refreshToken: z.string().optional(),
		})
		.optional(),
});

export const AuthValidation = {
	registerValidationSchema,
	loginValidationSchema,
	googleLoginValidationSchema,
	refreshTokenValidationSchema,
};
