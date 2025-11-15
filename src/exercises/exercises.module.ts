import { Module } from "@nestjs/common";
import { ExercisesController } from "./exercises.controller";
import { ExercisesService } from "./exercises.service";
import { PrismaService } from "src/prisma/prisma.service";
import { UsersModule } from "src/users/users.module";
import { CollectionsModule } from "src/collections/collections.module";
import { CommonModule } from "src/common/common.module";
import { QuizService } from "./quiz.service";

@Module({
	imports: [CommonModule, UsersModule, CollectionsModule],
	controllers: [ExercisesController],
	providers: [ExercisesService, PrismaService, QuizService],
})
export class ExercisesModule {}
