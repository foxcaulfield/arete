import { Module } from "@nestjs/common";
import { ExercisesController } from "./exercises.controller";
import { ExercisesService } from "./exercises.service";
import { PrismaService } from "src/prisma/prisma.service";
import { UsersModule } from "src/users/users.module";
import { CollectionsModule } from "src/collections/collections.module";
import { FileStorageModule } from "@getlarge/nestjs-tools-file-storage";
import { ConfigService } from "@nestjs/config";
import { fileStorageFactory } from "src/configs/file-storage.config";

@Module({
	imports: [
		UsersModule,
		CollectionsModule,
		FileStorageModule,
		FileStorageModule.forRootAsync({
			inject: [ConfigService],
			useFactory: fileStorageFactory,
		}),
	],
	controllers: [ExercisesController],
	providers: [ExercisesService, PrismaService],
})
export class ExercisesModule {}
