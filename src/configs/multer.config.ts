// src/config/multer.config.ts
import { BadRequestException } from "@nestjs/common";
import { MulterField, MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";

// File size limits in bytes
export const FILE_SIZE_LIMITS = {
	AUDIO: 1 * 1024 * 1024, // 1 MB
	IMAGE: 1 * 1024 * 1024, // 1 MB
} as const;

const fileFilter: MulterOptions["fileFilter"] = (_req, file, cb): void => {
	if (file.fieldname === "image") {
		return /image\/(jpeg|png|webp|gif)/.test(file.mimetype)
			? cb(null, true)
			: cb(new BadRequestException("Invalid image file type"), false);
	}
	if (file.fieldname === "audio") {
		return /audio\/(mpeg|wav|ogg|webm|mp4|x-m4a)/.test(file.mimetype)
			? cb(null, true)
			: cb(new BadRequestException("Invalid audio file type"), false);
	}
	cb(new BadRequestException("Invalid file type"), false);
};

export const multerField = (name: string, maxCount: number = 1): MulterField => ({ name, maxCount });

export const multerConfig = {
	exerciseFileUpload: {
		limits: {
			fileSize: Math.max(FILE_SIZE_LIMITS.AUDIO, FILE_SIZE_LIMITS.IMAGE),
			files: 2,
			fieldNameSize: 100,
		},
		fileFilter: fileFilter,
	} satisfies MulterOptions,

	profileImageUpload: {
		limits: {
			fileSize: FILE_SIZE_LIMITS.IMAGE,
			files: 1,
		},
		fileFilter: fileFilter,
	} satisfies MulterOptions,
};
