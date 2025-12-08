import { Module } from "@nestjs/common";
import { FilesService } from "./files.service";
import { FileStorageModule } from "@getlarge/nestjs-tools-file-storage";
import { ConfigService } from "@nestjs/config";
import { fileStorageFactory } from "src/configs/file-storage.config";
import { UtilsService } from "./utils.service";
import { PaginationService } from "./pagination.service";
import { APP_LIMITS_SYMBOL, defaultAppLimits } from "src/configs/app-limits.config";

@Module({
	imports: [
		FileStorageModule.forRootAsync({
			inject: [ConfigService],
			useFactory: fileStorageFactory,
		}),
	],
	providers: [
		{ provide: APP_LIMITS_SYMBOL, useValue: defaultAppLimits },
		FilesService,
		UtilsService,
		PaginationService,
	],
	exports: [APP_LIMITS_SYMBOL, FilesService, UtilsService, PaginationService],
})
export class CommonModule {}
