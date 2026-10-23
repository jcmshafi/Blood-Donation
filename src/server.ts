import app from "./app";
import config from "./app/config";
import { prisma } from "./app/lib/prisma";

const PORT = config.port || 5000;

const main = async () => {
	try {
		await prisma.$connect();
		console.log("Connected to the database successfully.");
		app.listen(PORT, () => {
			console.log(`Server is running on port ${PORT}`);
		});
	} catch (error) {
		console.error("Error starting the server:", error);
		await prisma.$disconnect();
		process.exit(1);
	}
};

// Only start listening when not running as a Vercel Serverless Function
if (!process.env.VERCEL) {
	main();
}

export default app;
