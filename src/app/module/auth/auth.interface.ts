import type { BloodGroup, Role } from "../../../generated/prisma/enums";

export interface IRegisterUserPayload {
	name: string;
	email: string;
	password: string;
	role?: Role;
	phone?: string;
	address?: string;
	bloodGroup?: BloodGroup;
	latitude?: number;
	longitude?: number;
}

export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IGoogleLoginPayload {
	idToken: string;
	role?: Role;
}

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}
