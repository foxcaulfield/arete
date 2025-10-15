/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient, UserRole } from "@prisma/client";
// import { PrismaClient } from "generated/prisma";  /* Alt path, depends on your 'client' -> 'output' value in your schema.prisma file */

const prismaClient = new PrismaClient().$extends({
	query: {
		user: {
			create({ args, query }) {
				// Ensure role is always set to 'USER' on creation
				// if (args.data) {
				args.data.role = UserRole.USER;
				args.data.emailVerified = false;
				// }
				return query(args);
			},
		},
	},
});
export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET,

	database: prismaAdapter(prismaClient, {
		provider: "postgresql",
	}),

	emailAndPassword: {
		enabled: true,
	},

	/* Settings that will be added to session data (client-side) */
	// user: {
	// 	additionalFields: {
	// 		role: {
	// 			fieldName: "role",
	// 			type: "string",
	// 		},
	// 	},
	// },

	// Frontend origin
	trustedOrigins: ["http://localhost:5173"],
});
