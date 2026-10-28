import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "./prisma/prisma.service";
import { UsersModule } from "./users/users.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { APP_GUARD } from "@nestjs/core";
import { CollectionsModule } from "./collections/collections.module";
import { AdminModule } from "./admin/admin.module";
// import { PermissionsGuard } from "./guards/permissions.guard";
// import { RolesGuard } from "./guards/roles.guard";
import { SignUpHook } from "./hooks/auth.hook";
import { ExercisesModule } from "./exercises/exercises.module";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { envValidationSchema } from "./configs/joi-env.config";
import { CommonModule } from "./common/common.module";
import { ScheduleModule } from "@nestjs/schedule";
import { auth } from "./configs/better-auth.config";
import { APP_LIMITS_SYMBOL, defaultAppLimits } from "./configs/app-limits.config";
import { SrsService } from "./srs/srs.service";
import { SrsModule } from "./srs/srs.module";

@Module({
	imports: [
		ThrottlerModule.forRoot([
			{ name: "short", ttl: 1000, limit: 3 },
			{ name: "medium", ttl: 10000, limit: 20 },
			{ name: "long", ttl: 60000, limit: 100 },
		]),
		AuthModule.forRoot({
			auth,
			bodyParser: {
				json: { limit: "10mb" },
				urlencoded: { extended: true, limit: "10mb" },
			},
		}),
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [".env"],
			validationSchema: envValidationSchema,
			validationOptions: { allowUnknown: true, abortEarly: false },
		}),
		UsersModule,
		PrismaModule,
		CollectionsModule,
		AdminModule,
		ExercisesModule,
		CommonModule,
		ServeStaticModule.forRoot({
			rootPath: join(process.cwd(), "public", "app"),
			serveRoot: "/app",
		}),
		ScheduleModule.forRoot(),
		SrsModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		PrismaService,
		{ provide: APP_LIMITS_SYMBOL, useValue: defaultAppLimits },
		// AuthGuard removed — registered globally by AuthModule
		// { provide: APP_GUARD, useClass: RolesGuard },
		// { provide: APP_GUARD, useClass: PermissionsGuard },
		{ provide: APP_GUARD, useClass: ThrottlerGuard },
		SignUpHook,
		SrsService,
	],
})
export class AppModule {}
