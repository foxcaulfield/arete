import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { SrsModule } from "src/srs/srs.module";

@Module({
	imports: [PrismaModule, SrsModule],
	providers: [UsersService],
	exports: [UsersService],
})
export class UsersModule {}
