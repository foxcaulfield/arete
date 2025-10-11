import { Module } from "@nestjs/common";
import { JwtModule, JwtModuleOptions } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { UsersModule } from "src/users/users.module";
import { PrismaModule } from "src/prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { LocalStrategy } from "./strategies/local.strategy";

@Module({
	imports: [
		UsersModule,
		PrismaModule,
		PassportModule,
		JwtModule.registerAsync({
			imports: [ConfigModule],
			useFactory: (configService: ConfigService): JwtModuleOptions => ({
				secret: configService.get<string>("JWT_SECRET"),
				signOptions: {
					expiresIn: "15m",
				},
			}),
			inject: [ConfigService],
		}),
	],
	providers: [AuthService, JwtStrategy, LocalStrategy],
	exports: [AuthService, JwtModule],
	controllers: [AuthController],
})
export class AuthModule {}
