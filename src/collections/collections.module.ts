import { Module } from "@nestjs/common";
import { CollectionsService } from "./collections.service";
import { CollectionsController } from "./collections.controller";
import { PrismaService } from "src/prisma/prisma.service";
import { UsersModule } from "src/users/users.module";
import { CommonModule } from "src/common/common.module";
import { CollectionAnalyticsService } from "./collection-analytics.service";
import { CollectionAccessService } from "./collection-access.service";
import { CollectionSharingService } from "./collection-sharing.service";

@Module({
	imports: [UsersModule, CommonModule],
	providers: [
		CollectionsService,
		PrismaService,
		CollectionAnalyticsService,
		CollectionAccessService,
		CollectionSharingService,
	],
	controllers: [CollectionsController],
	exports: [CollectionsService, CollectionAccessService, CollectionSharingService],
})
export class CollectionsModule {}
