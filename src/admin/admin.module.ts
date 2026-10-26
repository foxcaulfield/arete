import { Module } from "@nestjs/common";
import { AdminUsersController } from "./users.controller";
import { AdminUsersService } from "./users.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { CollectionsModule } from "src/collections/collections.module";
import { AdminCollectionsController } from "./collections.controller";
// import { CollectionsController } from './collections.controller';

@Module({
	imports: [PrismaModule, CollectionsModule],
	controllers: [AdminUsersController, AdminCollectionsController],
	providers: [AdminUsersService],
	exports: [AdminUsersService],
})
export class AdminModule {}
