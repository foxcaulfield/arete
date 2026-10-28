import { Module } from "@nestjs/common";
import { AdminUsersController } from "./users.controller";
import { AdminUsersService } from "./users.service";
import { AdminCollectionsController } from "./collections.controller";
import { PrismaModule } from "src/prisma/prisma.module";
import { CollectionsModule } from "src/collections/collections.module";
import { UsersModule } from "src/users/users.module";
import { PaginationService } from "src/common/pagination.service";
import { RolesGuard } from "src/guards/roles.guard";

@Module({
	imports: [PrismaModule, CollectionsModule, UsersModule],
	controllers: [AdminUsersController, AdminCollectionsController],
	providers: [AdminUsersService, PaginationService, RolesGuard],
	exports: [AdminUsersService],
})
export class AdminModule {}
