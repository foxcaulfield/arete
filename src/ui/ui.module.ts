import { Module } from "@nestjs/common";
import { UiController } from "./ui.controller";
import { CollectionsModule } from "src/collections/collections.module";
import { ExercisesModule } from "src/exercises/exercises.module";

@Module({
	imports: [CollectionsModule, ExercisesModule],
	controllers: [UiController],
})
export class UiModule {}
