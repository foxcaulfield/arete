/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PrismaService } from "./prisma/prisma.service";
import { UsersModule } from "./users/users.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthGuard, AuthModule } from "@thallesp/nestjs-better-auth";
import { APP_GUARD } from "@nestjs/core";
import { CollectionsModule } from "./collections/collections.module";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RolesGuard } from "./guards/roles.guard";
import { SignUpHook } from "./hooks/auth.hook";
import { ExercisesModule } from "./exercises/exercises.module";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient, UserRole } from "@prisma/client";

import { envValidationSchema, EnvConfig } from "./configs/joi-env.config";

@Module({
	imports: [
		AuthModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService<EnvConfig, true>) => {
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
						useSecureCookies: configService.get("NODE_ENV", { infer: true }) === "production",
						// defaultCookieAttributes: {
						// 	sameSite: "None",
						// },
						defaultCookieAttributes: {
							sameSite:
								configService.get("NODE_ENV", { infer: true }) === "production" ? "none" : undefined,
							partitioned: configService.get("NODE_ENV", { infer: true }) === "production" ? true : false, // Disable in dev
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
			},
		}),
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [".env"],
			validationSchema: envValidationSchema,
			validationOptions: {
				allowUnknown: true,
				abortEarly: false,
			},
		}),
		UsersModule,
		PrismaModule,
		CollectionsModule,
		ExercisesModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		PrismaService,
		{
			provide: APP_GUARD, // <-
			useClass: AuthGuard, // <-
		},
		{
			provide: APP_GUARD,
			useClass: RolesGuard,
		},
		{
			provide: APP_GUARD,
			useClass: PermissionsGuard,
		},
		SignUpHook,
	],
})
export class AppModule {}
