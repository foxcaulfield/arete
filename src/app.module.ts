import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { PrismaService } from "./prisma/prisma.service";
import { UsersModule } from "./users/users.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthGuard, AuthModule } from "@thallesp/nestjs-better-auth";
import { APP_GUARD } from "@nestjs/core";
import { CollectionsModule } from "./collections/collections.module";
import { AdminModule } from "./admin/admin.module";
import { PermissionsGuard } from "./guards/permissions.guard";
import { RolesGuard } from "./guards/roles.guard";
import { SignUpHook } from "./hooks/auth.hook";
import { ExercisesModule } from "./exercises/exercises.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";

import { envValidationSchema } from "./configs/joi-env.config";
import { CommonModule } from "./common/common.module";
import { ScheduleModule } from "@nestjs/schedule";
import { UiModule } from "./ui/ui.module";
import { ViewContextMiddleware } from "./middlewares/view-context.middleware";
import { betterAuthConfigFactory } from "./configs/better-auth.config";
import { APP_LIMITS_SYMBOL, defaultAppLimits } from "./configs/app-limits.config";

@Module({
	imports: [
		ThrottlerModule.forRoot([
			{
				name: "short",
				ttl: 1000, // 1 second
				limit: 3, // 3 requests per second
			},
			{
				name: "medium",
				ttl: 10000, // 10 seconds
				limit: 20, // 20 requests per 10 seconds
			},
			{
				name: "long",
				ttl: 60000, // 1 minute
				limit: 100, // 100 requests per minute
			},
		]),
		AuthModule.forRootAsync({
			inject: [ConfigService],
			useFactory: betterAuthConfigFactory,
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
		// Admin module contains admin-only endpoints (users management)
		AdminModule,
		ExercisesModule,
		CommonModule,
		ServeStaticModule.forRoot({
			rootPath: join(process.cwd(), "public"),
			serveRoot: "/static",
		}),
		ScheduleModule.forRoot(),
		UiModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		PrismaService,
		{ provide: APP_LIMITS_SYMBOL, useValue: defaultAppLimits },
		{
			provide: APP_GUARD,
			useClass: AuthGuard,
		},
		{
			provide: APP_GUARD,
			useClass: RolesGuard,
		},
		{
			provide: APP_GUARD,
			useClass: PermissionsGuard,
		},
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard,
		},
		SignUpHook,
	],
})
export class AppModule implements NestModule {
	public configure(consumer: MiddlewareConsumer): void {
		consumer.apply(ViewContextMiddleware).forRoutes("/ui", "ui/*");
	}
}
