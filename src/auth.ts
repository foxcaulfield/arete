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
	baseURL: process.env.API_URL || "http://localhost:3000",
	hooks: {},

	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		cookiePrefix: process.env.COOKIE_PREFIX || "arete",
		// For cross-domain (not subdomain), disable crossSubDomainCookies
		// and rely on CORS with credentials instead
		crossSubDomainCookies: {
			enabled: false,
		},
		useSecureCookies: process.env.NODE_ENV === "production",
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24, // Update every day
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
		},
	},
	trustedOrigins: process.env.TRUSTED_ORIGINS
		? process.env.TRUSTED_ORIGINS.split(",")
		: ["http://localhost:5173", "http://localhost:3000"],
});
