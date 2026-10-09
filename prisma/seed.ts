import bcrypt from "bcryptjs";
import { prisma } from "../src/app/lib/prisma";
import { Role, UserStatus, BloodGroup } from "../src/generated/prisma/client";

async function main() {
	console.log("Seeding database...");

	const hashedPasswordAdmin = await bcrypt.hash("Admin@123456", 10);
	const hashedPasswordDonor = await bcrypt.hash("Donor@123456", 10);
	const hashedPasswordRecipient = await bcrypt.hash("Recipient@123456", 10);

	// 1. Seed Demo Admin
	const admin = await prisma.user.upsert({
		where: { email: "admin@bloodemergency.org" },
		update: {},
		create: {
			name: "Demo Admin",
			email: "admin@bloodemergency.org",
			password: hashedPasswordAdmin,
			role: Role.ADMIN,
			status: UserStatus.ACTIVE,
			phone: "+8801900000000",
			address: "Dhaka HQ",
		},
	});
	console.log(`Admin user ensured: ${admin.email}`);

	// 2. Seed Demo Donor
	const donor = await prisma.user.upsert({
		where: { email: "donor@bloodemergency.org" },
		update: {},
		create: {
			name: "Demo Donor (Rahim)",
			email: "donor@bloodemergency.org",
			password: hashedPasswordDonor,
			role: Role.DONOR,
			status: UserStatus.ACTIVE,
			phone: "+8801700000001",
			address: "Mirpur 10, Dhaka",
			donorProfile: {
				create: {
					bloodGroup: BloodGroup.O_POSITIVE,
					isAvailable: true,
					latitude: 23.8071,
					longitude: 90.3686,
					phone: "+8801700000001",
					address: "Mirpur 10, Dhaka",
				},
			},
		},
	});
	console.log(`Donor user ensured: ${donor.email}`);

	// 3. Seed Demo Recipient
	const recipient = await prisma.user.upsert({
		where: { email: "recipient@bloodemergency.org" },
		update: {},
		create: {
			name: "Demo Recipient (Karim)",
			email: "recipient@bloodemergency.org",
			password: hashedPasswordRecipient,
			role: Role.RECIPIENT,
			status: UserStatus.ACTIVE,
			phone: "+8801800000001",
			address: "Dhanmondi, Dhaka",
		},
	});
	console.log(`Recipient user ensured: ${recipient.email}`);

	console.log("Seeding completed successfully!");
}

main()
	.catch((e) => {
		console.error("Error seeding database:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
