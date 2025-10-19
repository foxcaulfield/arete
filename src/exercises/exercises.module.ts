import { Module } from "@nestjs/common";
import { ExercisesController } from "./exercises.controller";
import { ExercisesService } from "./exercises.service";
import { PrismaService } from "src/prisma/prisma.service";
import { UsersModule } from "src/users/users.module";
import { CollectionsModule } from "src/collections/collections.module";

@Module({
	imports: [UsersModule, CollectionsModule],
	controllers: [ExercisesController],
	providers: [ExercisesService, PrismaService],
})
export class ExercisesModule {}
