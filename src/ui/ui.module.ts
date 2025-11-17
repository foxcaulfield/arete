import { Module } from "@nestjs/common";
import { UiController } from "./ui.controller";
import { CollectionsModule } from "src/collections/collections.module";

@Module({
	imports: [CollectionsModule],
	controllers: [UiController],
})
export class UiModule {}
