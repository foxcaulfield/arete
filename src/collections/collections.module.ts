import { Module } from "@nestjs/common";
import { CollectionsService } from "./collections.service";
import { CollectionsController } from "./collections.controller";
import { PrismaService } from "src/prisma/prisma.service";
import { UsersModule } from "src/users/users.module";

@Module({
	imports: [UsersModule],
	providers: [CollectionsService, PrismaService],
	controllers: [CollectionsController],
	exports: [CollectionsService],
})
export class CollectionsModule {}
