import { Module } from "@nestjs/common";
import { FilesService } from "./files.service";
import { FileStorageModule } from "@getlarge/nestjs-tools-file-storage";
import { ConfigService } from "@nestjs/config";
import { fileStorageFactory } from "src/configs/file-storage.config";

@Module({
	imports: [
		FileStorageModule.forRootAsync({
			inject: [ConfigService],
			useFactory: fileStorageFactory,
		}),
	],
	providers: [FilesService],
	exports: [FilesService],
})
export class CommonModule {}
