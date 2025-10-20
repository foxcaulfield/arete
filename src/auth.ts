/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient, UserRole } from "@prisma/client";

const prismaClient = new PrismaClient().$extends({
	query: {
		user: {
			create({ args, query }) {
				// Ensure role is always set to 'USER' on creation
				args.data.role = UserRole.USER;
				args.data.emailVerified = false;
				return query(args);
			},
		},
	},
});
export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET as string,
	database: prismaAdapter(prismaClient, {
		provider: "postgresql",
	}),
	hooks: {},

	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		cookiePrefix: process.env.COOKIE_PREFIX || "arete",
		crossSubDomainCookies: {
			enabled: true, // Allow cookies across subdomains
		},
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // Update every day
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
		},
	},
	trustedOrigins: [process.env.FRONTEND_ORIGIN || "http://localhost:5173"],
});
