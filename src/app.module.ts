import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule } from "@nestjs/config";
import { PrismaService } from "./prisma/prisma.service";
import { UsersModule } from "./users/users.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthGuard, AuthModule } from "@thallesp/nestjs-better-auth";
import { auth } from "./auth";
import { APP_GUARD } from "@nestjs/core";
import { RolesGuard } from "./guards/roles.guard";

@Module({
	imports: [
		AuthModule.forRoot({ auth }),
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: [".env"],
		}),
		UsersModule,
		PrismaModule,
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
	],
})
export class AppModule {}
