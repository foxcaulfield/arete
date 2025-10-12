import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { UsersModule } from "src/users/users.module";
import { PrismaModule } from "src/prisma/prisma.module";
import { AuthController } from "./auth.controller";
// import { LocalStrategy } from "./strategies/local.strategy";

@Module({
	imports: [UsersModule, PrismaModule],
	providers: [AuthService],
	exports: [AuthService],
	controllers: [AuthController],
})
export class AuthModule {}
