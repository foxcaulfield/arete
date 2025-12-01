import { Module } from "@nestjs/common";
import { FilesService } from "./files.service";
import { FileStorageModule } from "@getlarge/nestjs-tools-file-storage";
import { ConfigService } from "@nestjs/config";
import { fileStorageFactory } from "src/configs/file-storage.config";
import { UtilsService } from "./utils.service";
import { PaginationService } from "./pagination.service";

@Module({
	imports: [
		FileStorageModule.forRootAsync({
			inject: [ConfigService],
			useFactory: fileStorageFactory,
		}),
	],
	providers: [FilesService, UtilsService, PaginationService],
	exports: [FilesService, UtilsService, PaginationService],
})
export class CommonModule {}
