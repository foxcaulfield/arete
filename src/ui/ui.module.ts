import { Module } from "@nestjs/common";
import { UiController } from "./ui.controller";
import { AdminUiController } from "./admin-ui.controller";
import { UiService } from "./ui.service";
import { AdminUiService } from "./admin-ui.service";
import { CollectionsModule } from "src/collections/collections.module";
import { ExercisesModule } from "src/exercises/exercises.module";
import { PrismaModule } from "src/prisma/prisma.module";

@Module({
	imports: [CollectionsModule, ExercisesModule, PrismaModule],
	controllers: [UiController, AdminUiController],
	providers: [UiService, AdminUiService],
})
export class UiModule {}
