// src/config/multer.config.ts
import { BadRequestException } from "@nestjs/common";
import { MulterField, MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
// import { diskStorage } from "multer";
// import { extname } from "path";
// import * as crypto from "crypto";

const fileFilter: MulterOptions["fileFilter"] = (_req, file, cb): void => {
	console.log("Uploading file:", file.originalname);
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
			fileSize: 10 * 1024 * 1024, // 10 MB
			files: 2,
			fieldNameSize: 100,
		},
		fileFilter: fileFilter,
	} satisfies MulterOptions,

	profileImageUpload: {
		limits: {
			fileSize: 5 * 1024 * 1024, // 5 MB
			files: 1,
		},
		fileFilter: fileFilter,
	} satisfies MulterOptions,
};
