import { FileStorageService, StorageType } from "@getlarge/nestjs-tools-file-storage";
import { Injectable, Logger, StreamableFile, BadRequestException } from "@nestjs/common";
import { ExerciseFileType } from "src/common/enums/exercise-file-type.enum";
import { extname } from "path";
import { v4 as uuid4 } from "uuid";

@Injectable()
export class FilesService {
	private readonly logger = new Logger(FilesService.name);

	private readonly fileTypeToFolderMap = {
		[ExerciseFileType.AUDIO]: "audio",
		[ExerciseFileType.IMAGE]: "images",
	} as const;

	private readonly mimeTypeMap = {
		[ExerciseFileType.AUDIO]: "audio/mpeg",
		[ExerciseFileType.IMAGE]: "image/jpeg",
	} as const satisfies Record<ExerciseFileType, string>;

	public constructor(private readonly fileStorageService: FileStorageService<StorageType.FS>) {}

	public async getFile({
		filetype,
		filename,
	}: {
		filetype: ExerciseFileType;
		filename: string;
	}): Promise<StreamableFile> {
		const folder = this.fileTypeToFolderMap[filetype];
		const stream = await this.fileStorageService.downloadStream({
			filePath: `${folder}/${filename}`,
		});

		return new StreamableFile(stream, {
			type: this.mimeTypeMap[filetype],
		});
	}

	public async deleteFile(fileType: ExerciseFileType, filename: string): Promise<void> {
		const folder = this.fileTypeToFolderMap[fileType];
		try {
			await this.fileStorageService.deleteFile({
				filePath: `${folder}/${filename}`,
			});
		} catch (error: unknown) {
			// console.log("error", JSON.stringify(error));
			this.logger.warn(`Failed to delete file ${filename}:`, error);
		}
	}

	public async uploadFile(fileType: ExerciseFileType, filename: string, buffer: Buffer): Promise<void> {
		const folder = this.fileTypeToFolderMap[fileType];
		await this.fileStorageService.uploadFile({
			content: buffer,
			filePath: `${folder}/${filename}`,
		});
	}

	public async handleSingleFileUploads(
		file?: Express.Multer.File,
		fileType?: ExerciseFileType,
		previousUrl?: string | null,
		setNull?: boolean
	): Promise<{ filename: string | null }> {
		const hasNewFile = file !== undefined;
		const shouldClearExisting = setNull === true;
		const hasPrevious = !!previousUrl;
		const newFilename = file ? this.generateUniqueFilename(file) : null;

		try {
			// Delete previous files if new ones are uploaded OR if explicitly cleared (null incoming)
			if ((shouldClearExisting || hasNewFile) && hasPrevious) {
				await this.deleteFile(fileType!, previousUrl);
			}

			// Upload new files
			if (!shouldClearExisting && hasNewFile && newFilename) {
				await this.uploadFile(fileType!, newFilename, file.buffer);
			}
			return {
				filename: shouldClearExisting ? null : hasNewFile ? newFilename : (previousUrl ?? null),
			};
		} catch (error) {
			this.logger.error("File upload failed", error);
			// Cleanup any successfully uploaded files
			if (newFilename) {
				await this.deleteFile(fileType!, newFilename);
			}
			throw new BadRequestException(
				`File upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	/**
	 * Generates a unique filename for uploaded files
	 */
	public generateUniqueFilename(file: Express.Multer.File): string {
		const extension = extname(file.originalname) || file.mimetype.split("/")[1];
		const safeExtension = extension?.startsWith(".") ? extension.slice(1) : extension;
		return `${uuid4()}${safeExtension ? `.${safeExtension}` : ""}`;
	}
}
