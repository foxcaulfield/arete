import { FileStorageService, StorageType } from "@getlarge/nestjs-tools-file-storage";
import { Injectable, Logger, StreamableFile, BadRequestException } from "@nestjs/common";
import { ExerciseFileType } from "src/common/enums/exercise-file-type.enum";
import { extname } from "path";
import { v4 as uuid4 } from "uuid";

/**
 * Parameters used when handling a single file upload request.
 */
interface HandleSingleFileUploadsParams {
	file?: Express.Multer.File;
	fileType: ExerciseFileType;
	previousUrl?: string | null;
	setNull?: boolean;
}

const ALLOWED_MIME_TYPES: Record<ExerciseFileType, string[]> = {
	// include m4a
	[ExerciseFileType.AUDIO]: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "audio/x-m4a"],
	[ExerciseFileType.IMAGE]: ["image/jpeg", "image/png", "image/gif"],
};

@Injectable()
export class FilesService {
	private readonly logger = new Logger(FilesService.name);

	private readonly fileTypeToFolderMap = {
		[ExerciseFileType.AUDIO]: "audio",
		[ExerciseFileType.IMAGE]: "images",
	} as const;

	public constructor(private readonly fileStorageService: FileStorageService<StorageType.FS>) {}

	/**
	 * Streams a file back to the caller based on the requested exercise file type and file name.
	 */
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
			type: filetype === ExerciseFileType.AUDIO ? "audio/mpeg" : "image/jpeg",
		});
	}

	/**
	 * Deletes a previously stored file if it exists.
	 */
	public async deleteFile(fileType: ExerciseFileType, filename: string): Promise<void> {
		const folder = this.fileTypeToFolderMap[fileType];
		try {
			await this.fileStorageService.deleteFile({
				filePath: `${folder}/${filename}`,
			});
		} catch (error: unknown) {
			this.logger.warn(`Failed to delete file ${filename}:`, error);
		}
	}

	/**
	 * Uploads a file buffer to the configured storage backend.
	 */
	public async uploadFile(fileType: ExerciseFileType, filename: string, buffer: Buffer): Promise<void> {
		const folder = this.fileTypeToFolderMap[fileType];
		await this.fileStorageService.uploadFile({
			content: buffer,
			filePath: `${folder}/${filename}`,
		});
	}

	/**
	 * Handles a single upload request, deleting any previous file and optionally clearing the stored reference.
	 */
	public async handleFileUpload({
		fileType,
		file,
		previousUrl,
		setNull,
	}: HandleSingleFileUploadsParams): Promise<{ filename: string | null }> {
		const hasNewFile = file !== undefined;
		const shouldClearExisting = setNull === true;
		const hasPrevious = !!previousUrl;
		const newFilename = file ? this.generateUniqueFilename(file) : null;
		const incomingMimeType = file?.mimetype;
		const fileSize = file?.size || 0;

		// Validate incoming file
		if (hasNewFile && fileSize === 0) {
			throw new BadRequestException("File is empty");
		}

		if (hasNewFile && !incomingMimeType) {
			throw new BadRequestException("Invalid file type");
		}

		if (hasNewFile && incomingMimeType && !ALLOWED_MIME_TYPES[fileType].includes(incomingMimeType)) {
			throw new BadRequestException(
				`Unsupported file type for ${fileType}. Allowed: ${ALLOWED_MIME_TYPES[fileType].join(", ")}`
			);
		}

		try {
			// Delete previous files if new ones are uploaded OR if explicitly cleared (null incoming)
			if ((shouldClearExisting || hasNewFile) && hasPrevious) {
				await this.deleteFile(fileType, previousUrl);
			}

			// Upload new files
			if (!shouldClearExisting && hasNewFile && newFilename) {
				await this.uploadFile(fileType, newFilename, file.buffer);
			}
			return {
				filename: shouldClearExisting ? null : hasNewFile ? newFilename : (previousUrl ?? null),
			};
		} catch (error) {
			this.logger.error("File upload failed", error);
			// Cleanup any successfully uploaded files
			if (newFilename) {
				await this.deleteFile(fileType, newFilename);
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
