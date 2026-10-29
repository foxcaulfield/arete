// src/configs/better-auth.config.ts
import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";

const isProduction = process.env.NODE_ENV === "production";

const prismaClient = new PrismaClient().$extends({
	query: {
		user: {
			create({ args, query }): ReturnType<typeof query> {
				args.data.role = UserRole.USER;
				args.data.emailVerified = false;
				return query(args);
			},
		},
	},
});

export const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
	basePath: "/api/auth",
	secret: process.env.BETTER_AUTH_SECRET,
	database: prismaAdapter(prismaClient, {
		provider: process.env.DB_PROVIDER === "sqlite" ? "sqlite" : "postgresql",
	}),
	user: {
		additionalFields: {
			isActive: {
				type: "boolean",
				required: false,
				defaultValue: true,
				input: false,
			},
		},
	},
	hooks: {
		// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/require-await
		before: createAuthMiddleware(async (ctx) => {
			const blocked = ["/forget-password", "/reset-password", "/verify-email"];
			if (blocked.some((p): boolean => ctx.path.startsWith(p))) {
				throw new APIError("FORBIDDEN", { message: "Disabled" });
			}
		}),
	},
	databaseHooks: {
		session: {
			create: {
				// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
				before: async (session) => {
					const user = await prismaClient.user.findUnique({
						where: { id: session.userId },
						select: { isActive: true },
					});
					if (user && !user.isActive) {
						throw new APIError("FORBIDDEN", { message: "Account is deactivated" });
					}
					return { data: session };
				},
			},
		},
	},
	emailAndPassword: {
		enabled: true,
	},
	advanced: {
		cookiePrefix: process.env.COOKIE_PREFIX,
		crossSubDomainCookies: {
			enabled: false,
		},
		useSecureCookies: isProduction,
		defaultCookieAttributes: {
			sameSite: isProduction ? "none" : "lax",
			partitioned: isProduction,
		},
	},
	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
		cookieCache: {
			enabled: false,
		},
	},
	trustedOrigins: (process.env.TRUSTED_ORIGINS || "").split(",").filter(Boolean),
});

export type BetterAuthInstanceType = typeof auth;
