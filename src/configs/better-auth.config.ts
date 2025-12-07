import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "./joi-env.config";
import { PrismaClient, UserRole } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

export const betterAuthConfigFactory = (configService: ConfigService<EnvConfig, true>) => {
	const isProduction = configService.get("NODE_ENV", { infer: true }) === "production";

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
	const auth = betterAuth({
		// baseURL: process.env.API_URL,
		basePath: "/api/auth",
		secret: process.env.BETTER_AUTH_SECRET,
		database: prismaAdapter(prismaClient, {
			provider: "postgresql",
		}),
		hooks: {},
		emailAndPassword: {
			enabled: true,
		},
		advanced: {
			cookiePrefix: configService.get("COOKIE_PREFIX", { infer: true }),
			crossSubDomainCookies: {
				enabled: false,
			},
			useSecureCookies: isProduction,
			defaultCookieAttributes: {
				sameSite: isProduction ? "none" : "lax", // Use "none" only in production
				partitioned: isProduction ? true : false, // Disable in dev
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
		trustedOrigins: configService.get("TRUSTED_ORIGINS", { infer: true }).split(","),
	});

	return { auth };
};

export type BetterAuthInstanceType = ReturnType<typeof betterAuthConfigFactory>["auth"];
