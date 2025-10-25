// src/config/file-storage.config.ts
import { ConfigService } from "@nestjs/config";
import { FileStorageLocal } from "@getlarge/nestjs-tools-file-storage";
import { EnvConfig } from "src/configs/joi-env.config";

export const fileStorageFactory = (configService: ConfigService<EnvConfig, true>): FileStorageLocal => {
	return new FileStorageLocal({
		storagePath: configService.get("CONTAINER_FILE_STORAGE_PATH", { infer: true }),
		maxPayloadSize: configService.get("MAX_PAYLOAD_SIZE", { infer: true }),
	});
};
