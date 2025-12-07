import { Module } from "@nestjs/common";
import { AdminUsersController } from "./users.controller";
import { AdminUsersService } from "./users.service";
import { PrismaModule } from "src/prisma/prisma.module";

@Module({
    imports: [PrismaModule],
    controllers: [AdminUsersController],
    providers: [AdminUsersService],
    exports: [AdminUsersService],
})
export class AdminModule {}
