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

	/**
	 * Streams a file back to the caller based on the requested exercise file type and file name.
	 * @param filetype The type of exercise file (audio or image) so that we look up the correct folder and MIME type.
	 * @param filename The stored filename to load from the backing store.
	 * @returns A {@link StreamableFile} wrapper that includes the appropriate MIME type header.
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
			type: this.mimeTypeMap[filetype],
		});
	}

	/**
	 * Deletes a previously stored file if it exists.
	 * @param fileType The type of exercise file so the correct folder can be targeted.
	 * @param filename The stored filename to delete.
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
	 * @param fileType The exercise file type determining the destination folder.
	 * @param filename The target filename to store within the folder.
	 * @param buffer Raw file bytes to upload.
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
	 * @param params Upload parameters controlling the new file, clearing behavior, and previous file reference.
	 * @returns The filename that should be stored after processing, or {@code null} when clearing.
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
	/**
	 * Creates a collision-resistant filename based on a UUID and the incoming file extension.
	 * @param file The uploaded file whose original name and mimetype yield an extension.
	 * @returns A unique filename that preserves the original extension when available.
	 */
	public generateUniqueFilename(file: Express.Multer.File): string {
		const extension = extname(file.originalname) || file.mimetype.split("/")[1];
		const safeExtension = extension?.startsWith(".") ? extension.slice(1) : extension;
		return `${uuid4()}${safeExtension ? `.${safeExtension}` : ""}`;
	}
}
