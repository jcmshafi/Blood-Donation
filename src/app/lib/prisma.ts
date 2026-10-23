import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

const connectionString = process.env.DATABASE_URL || "";

declare global {
	// Prevent multiple instances of Prisma Client in serverless reloads
	// biome-ignore lint/style/noVar: global declaration requires var
	var __prisma: PrismaClient | undefined;
}

const createPrismaClient = () => {
	const adapter = new PrismaPg({ connectionString });
	return new PrismaClient({ adapter });
};

const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.__prisma = prisma;
}

export { prisma };
