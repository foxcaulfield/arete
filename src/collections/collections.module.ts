import { Module } from "@nestjs/common";
import { CollectionsService } from "./collections.service";
import { CollectionsController } from "./collections.controller";
import { PrismaService } from "src/prisma/prisma.service";

@Module({
	providers: [CollectionsService, PrismaService],
	controllers: [CollectionsController],
})
export class CollectionsModule {}
