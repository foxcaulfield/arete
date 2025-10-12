import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
// import { PrismaClient } from "generated/prisma";  /* Alt path, depends on your 'client' -> 'output' value in your schema.prisma file */

const prismaClient = new PrismaClient();
export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET,

	database: prismaAdapter(prismaClient, {
		provider: "postgresql",
	}),

	emailAndPassword: {
		enabled: true,
	},

	user: {
		additionalFields: {
			role: {
				fieldName: "role",
				type: "string",
			},
		},
	},

	// Your frontend origin
	trustedOrigins: ["http://localhost:5173"],
});
