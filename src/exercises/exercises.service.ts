import {
	ForbiddenException,
	Inject,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	StreamableFile,
} from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdateExerciseDto } from "./dto/update-exercise.dto";
import { CreateExerciseDto } from "./dto/create-exercise.dto";
import { ResponseExerciseDto } from "./dto/response-exercise.dto";
import { ExerciseSortBy, FilterExerciseDto, MediaFilter, SortOrder } from "./dto/filter-exercise.dto";
import { BaseService } from "src/base/base.service";
import { PaginatedResponseDto } from "src/common/types";
import { Exercise, Prisma, UserRole } from "@prisma/client";

import { ExerciseFileType } from "src/common/enums/exercise-file-type.enum";
import { FilesService } from "src/common/files.service";
import { ExerciseQueryService } from "./exercise-query.service";
import { ExerciseValidationService } from "./exercise-validation.service";
import { PaginationService } from "src/common/pagination.service";
import { CollectionAccessService } from "src/collections/collection-access.service";
import { APP_LIMITS_SYMBOL } from "src/configs/app-limits.config";
import type { AppLimitsConfig } from "src/configs/app-limits.config";

type MulterFile = Express.Multer.File;

interface UploadedFiles {
	audio?: MulterFile[];
	image?: MulterFile[];
}

@Injectable()
export class ExercisesService extends BaseService {
	private readonly logger = new Logger(ExercisesService.name);

	private readonly fileTypeToUrlPropMap = {
		[ExerciseFileType.AUDIO]: "audioUrl",
		[ExerciseFileType.IMAGE]: "imageUrl",
	} as const satisfies Record<ExerciseFileType, keyof Exercise>;

	public constructor(
		private readonly prismaService: PrismaService,
		private readonly filesService: FilesService,
		private readonly exerciseQueryService: ExerciseQueryService,
		private readonly exerciseValidationService: ExerciseValidationService,
		private readonly paginationService: PaginationService,
		private readonly collectionAccessService: CollectionAccessService,
		@Inject(APP_LIMITS_SYMBOL) private readonly appLimits: AppLimitsConfig
	) {
		super();
	}

	/* ===== PUBLIC METHODS ===== */

	public async create(
		currentUserId: string,
		dto: CreateExerciseDto,
		files?: UploadedFiles
	): Promise<ResponseExerciseDto> {
		await this.collectionAccessService.validateCollectionAccess(currentUserId, dto.collectionId);

		// Check exercise limit for non-admin users
		const user = await this.prismaService.user.findUnique({ where: { id: currentUserId }, select: { role: true } });
		if (user?.role === UserRole.USER) {
			const exerciseCount = await this.prismaService.exercise.count({
				where: { collectionId: dto.collectionId },
			});
			if (exerciseCount >= this.appLimits.USER_MAX_EXERCISES_PER_COLLECTION) {
				throw new ForbiddenException(
					`This collection has reached the maximum limit of ${this.appLimits.USER_MAX_EXERCISES_PER_COLLECTION} exercises.`
				);
			}
		}

		this.exerciseValidationService.validateAnswersAndDistractors(
			dto.correctAnswer,
			dto.additionalCorrectAnswers,
			dto.distractors,
			dto.type
		);
		let audioFilename: string | null = null;
		let imageFilename: string | null = null;

		try {
			const filesUploadResult = await this.handleExerciseFileUpload({ files });

			audioFilename = filesUploadResult.audioFilename;
			imageFilename = filesUploadResult.imageFilename;

			const { collectionId, ...rest } = dto;
			const exercise = await this.prismaService.exercise.create({
				data: {
					...rest,
					audioUrl: audioFilename,
					imageUrl: imageFilename,
					additionalCorrectAnswers: rest.additionalCorrectAnswers ?? [],
					distractors: rest.distractors ?? [],
					collection: {
						connect: { id: collectionId },
					},
				},
			});

			this.logger.log(`Exercise created: ${exercise.id} by user ${currentUserId}`);
			return this.toResponseDto(ResponseExerciseDto, exercise);
		} catch (error) {
			this.logger.error("Failed to create exercise", error);
			if (audioFilename) {
				await this.filesService.deleteFile(ExerciseFileType.AUDIO, audioFilename);
			}
			if (imageFilename) {
				await this.filesService.deleteFile(ExerciseFileType.IMAGE, imageFilename);
			}
			throw new InternalServerErrorException("Failed to create exercise");
		}
	}

	public async getExercisesInCollection(
		currentUserId: string,
		collectionId: string,
		filter: FilterExerciseDto
	): Promise<PaginatedResponseDto<ResponseExerciseDto>> {
		await this.collectionAccessService.validateCollectionAccess(currentUserId, collectionId);

		const {
			page = 1,
			limit = 10,
			search,
			type,
			sortBy = ExerciseSortBy.UPDATED_AT,
			sortOrder = SortOrder.DESC,
			hasImage,
			hasAudio,
		} = filter;

		// Normalize search - treat empty string as undefined
		const searchTerm = search?.trim() || undefined;

		// Build where clause
		const where: Prisma.ExerciseWhereInput = {
			collectionId,
			...(searchTerm && {
				OR: [
					{ question: { contains: searchTerm, mode: "insensitive" } },
					{ correctAnswer: { contains: searchTerm, mode: "insensitive" } },
					{ translation: { contains: searchTerm, mode: "insensitive" } },
				],
			}),
			...(type && { type }),
			...(hasImage === MediaFilter.HAS && { imageUrl: { not: null } }),
			...(hasImage === MediaFilter.NONE && { imageUrl: null }),
			...(hasAudio === MediaFilter.HAS && { audioUrl: { not: null } }),
			...(hasAudio === MediaFilter.NONE && { audioUrl: null }),
		};

		const total = await this.prismaService.exercise.count({ where });

		if (total === 0) {
			return this.paginationService.buildPaginatedResponse(
				this.toResponseDto(ResponseExerciseDto, []),
				total,
				page,
				limit
			);
		}

		const skip = this.paginationService.calculateSkip(page, limit);

		// If searching or filtering, use standard Prisma query
		if (searchTerm || type || hasImage || hasAudio) {
			const exercises = await this.prismaService.exercise.findMany({
				where,
				skip,
				take: limit,
				orderBy:
					sortBy === ExerciseSortBy.TOTAL_ATTEMPTS
						? { createdAt: sortOrder } // fallback for totalAttempts
						: { [sortBy]: sortOrder },
			});

			// Enrich with attempt counts
			const exerciseIds = exercises.map((e): string => e.id);
			const attemptCounts = await this.prismaService.attempt.groupBy({
				by: ["exerciseId", "isCorrect"],
				where: { userId: currentUserId, exerciseId: { in: exerciseIds } },
				_count: { id: true },
			});

			const enriched = exercises.map((e): ResponseExerciseDto => {
				const attempts = attemptCounts.filter((a): boolean => a.exerciseId === e.id);
				const totalAttempts = attempts.reduce((sum, a): number => sum + a._count.id, 0);
				const correctAttempts = attempts.find((a): boolean => a.isCorrect)?._count.id || 0;
				return { ...e, totalAttempts, correctAttempts };
			});

			return this.paginationService.buildPaginatedResponse(
				this.toResponseDto(ResponseExerciseDto, enriched),
				total,
				page,
				limit
			);
		}

		// Use optimized raw query only for default sort (totalAttempts desc)
		if (sortBy === ExerciseSortBy.TOTAL_ATTEMPTS) {
			const rows: Array<
				Exercise & {
					totalAttempts: number;
					correctAttempts: number;
				}
			> = await this.exerciseQueryService.getTopMostAttemptedExercises(collectionId, currentUserId, limit, skip);

			return this.paginationService.buildPaginatedResponse(
				this.toResponseDto(ResponseExerciseDto, rows),
				total,
				page,
				limit
			);
		}

		// Standard Prisma query with sorting for non-filtered, non-totalAttempts cases
		const exercises = await this.prismaService.exercise.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		});

		// Enrich with attempt counts
		const exerciseIds = exercises.map((e): string => e.id);
		const attemptCounts = await this.prismaService.attempt.groupBy({
			by: ["exerciseId", "isCorrect"],
			where: { userId: currentUserId, exerciseId: { in: exerciseIds } },
			_count: { id: true },
		});

		const enriched = exercises.map((e): ResponseExerciseDto => {
			const attempts = attemptCounts.filter((a): boolean => a.exerciseId === e.id);
			const totalAttempts = attempts.reduce((sum, a): number => sum + a._count.id, 0);
			const correctAttempts = attempts.find((a): boolean => a.isCorrect)?._count.id || 0;
			return { ...e, totalAttempts, correctAttempts };
		});

		return this.paginationService.buildPaginatedResponse(
			this.toResponseDto(ResponseExerciseDto, enriched),
			total,
			page,
			limit
		);
	}

	public async getExerciseById(currentUserId: string, exerciseId: string): Promise<ResponseExerciseDto> {
		const exercise = await this.findExerciseOrFail(exerciseId);
		await this.collectionAccessService.validateCollectionAccess(currentUserId, exercise.collectionId);

		// Get user's attempt statistics for this exercise
		const attemptStats = await this.prismaService.attempt.groupBy({
			by: ["isCorrect"],
			where: { userId: currentUserId, exerciseId },
			_count: { id: true },
		});

		const totalAttempts = attemptStats.reduce((sum, a): number => sum + a._count.id, 0);
		const correctAttempts = attemptStats.find((a): boolean => a.isCorrect)?._count.id || 0;

		// Get last attempt date
		const lastAttempt = await this.prismaService.attempt.findFirst({
			where: { userId: currentUserId, exerciseId },
			orderBy: { createdAt: "desc" },
			select: { createdAt: true },
		});

		return this.toResponseDto(ResponseExerciseDto, {
			...exercise,
			totalAttempts,
			correctAttempts,
			lastAttemptAt: lastAttempt?.createdAt || null,
		});
	}

	public async update(
		currentUserId: string,
		exerciseId: string,
		dto: UpdateExerciseDto,
		files?: UploadedFiles
	): Promise<ResponseExerciseDto> {
		const exercise = await this.findExerciseOrFail(exerciseId);
		await this.collectionAccessService.validateCollectionAccess(currentUserId, exercise.collectionId);

		this.exerciseValidationService.validateAnswersAndDistractors(
			dto.correctAnswer ?? exercise.correctAnswer,
			dto.additionalCorrectAnswers ?? exercise.additionalCorrectAnswers,
			dto.distractors ?? exercise.distractors,
			dto.type ?? exercise.type
		);

		let audioFilename: string | null = null;
		let imageFilename: string | null = null;

		try {
			const { audioFilename: audioResult, imageFilename: imageResult } = await this.handleExerciseFileUpload({
				files,
				prevAudio: exercise.audioUrl ?? undefined,
				prevImage: exercise.imageUrl ?? undefined,
				setNullAudio: dto.setNullAudio,
				setNullImage: dto.setNullImage,
			});
			audioFilename = audioResult;
			imageFilename = imageResult;

			delete dto.setNullAudio;
			delete dto.setNullImage;

			const updated = await this.prismaService.exercise.update({
				where: { id: exerciseId },
				data: {
					...dto,
					additionalCorrectAnswers: dto.additionalCorrectAnswers === null ? [] : dto.additionalCorrectAnswers,
					distractors: dto.distractors === null ? [] : dto.distractors,
					audioUrl: audioFilename,
					imageUrl: imageFilename,
				},
			});

			this.logger.log(`Exercise updated: ${exerciseId} by user ${currentUserId}`);
			return this.toResponseDto(ResponseExerciseDto, updated);
		} catch (error) {
			this.logger.error("Failed to update exercise", error);
			if (audioFilename) {
				await this.filesService.deleteFile(ExerciseFileType.AUDIO, audioFilename);
			}
			if (imageFilename) {
				await this.filesService.deleteFile(ExerciseFileType.IMAGE, imageFilename);
			}
			throw new InternalServerErrorException("Failed to update exercise");
		}
	}

	public async delete(currentUserId: string, exerciseId: string): Promise<ResponseExerciseDto> {
		const exercise = await this.findExerciseOrFail(exerciseId);
		await this.collectionAccessService.validateCollectionAccess(currentUserId, exercise.collectionId);

		// Delete associated files (non-blocking)
		await this.deleteExerciseFiles(exercise);

		const deleted = await this.prismaService.exercise.delete({
			where: { id: exerciseId },
		});

		this.logger.log(`Exercise deleted: ${exerciseId} by user ${currentUserId}`);
		return this.toResponseDto(ResponseExerciseDto, deleted);
	}

	/* ===== FILE HANDLING ===== */

	public async getExerciseFile(
		currentUserId: string,
		filename: string,
		filetype: ExerciseFileType
	): Promise<StreamableFile> {
		const fileNameProp = this.fileTypeToUrlPropMap[filetype];

		const exercise = await this.prismaService.exercise.findFirst({
			where: { [fileNameProp]: filename },
		});

		if (!exercise) {
			throw new NotFoundException("Exercise not found for the given file");
		}

		await this.collectionAccessService.validateCollectionAccess(currentUserId, exercise.collectionId);

		return this.filesService.getFile({ filetype, filename });
	}

	/* ===== PRIVATE HELPER METHODS ===== */

	/**
	 * Finds an exercise by ID or throws NotFoundException
	 */
	public async findExerciseOrFail(id: string): Promise<Exercise> {
		const exercise = await this.prismaService.exercise.findUnique({
			where: { id },
		});

		if (!exercise) {
			throw new NotFoundException(`Exercise with ID ${id} not found`);
		}

		return exercise;
	}

	/**
	 * Deletes all files associated with an exercise
	 */
	private async deleteExerciseFiles(exercise: Exercise): Promise<void> {
		const deletionPromises: Promise<void>[] = [];

		if (exercise.audioUrl) {
			deletionPromises.push(this.filesService.deleteFile(ExerciseFileType.AUDIO, exercise.audioUrl));
		}
		if (exercise.imageUrl) {
			deletionPromises.push(this.filesService.deleteFile(ExerciseFileType.IMAGE, exercise.imageUrl));
		}

		const results = await Promise.allSettled(deletionPromises);

		// Log any failures but don't throw
		results.forEach((result, index): void => {
			if (result.status === "rejected") {
				const fileType = index === 0 ? "audio" : "image";
				this.logger.error(`Failed to delete ${fileType} file for exercise ${exercise.id}`, result.reason);
			}
		});
	}

	/* Private */
	private validateFileSize(file: MulterFile | undefined, fileType: ExerciseFileType): void {
		if (!file) return;

		const maxSize =
			fileType === ExerciseFileType.AUDIO
				? this.appLimits.MAX_AUDIO_FILE_SIZE
				: this.appLimits.MAX_IMAGE_FILE_SIZE;

		if (file.size > maxSize) {
			const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
			throw new ForbiddenException(`${fileType} file exceeds maximum size of ${maxSizeMB} MB`);
		}
	}

	private async handleExerciseFileUpload({
		files,
		prevAudio,
		prevImage,
		setNullAudio,
		setNullImage,
	}: {
		files?: UploadedFiles;
		prevAudio?: string;
		prevImage?: string;
		setNullAudio?: boolean;
		setNullImage?: boolean;
	}): Promise<{ audioFilename: string | null; imageFilename: string | null }> {
		// Validate file sizes before upload
		this.validateFileSize(files?.audio?.[0], ExerciseFileType.AUDIO);
		this.validateFileSize(files?.image?.[0], ExerciseFileType.IMAGE);

		const result = await Promise.all(
			[
				[files?.audio?.[0], ExerciseFileType.AUDIO, prevAudio, setNullAudio] as const,
				[files?.image?.[0], ExerciseFileType.IMAGE, prevImage, setNullImage] as const,
			].map(async ([file, fileType, previousUrl, setNull]): Promise<{ filename: string | null }> => {
				return this.filesService.handleFileUpload({ file, fileType, previousUrl, setNull });
			})
		);
		return { audioFilename: result[0]?.filename ?? null, imageFilename: result[1]?.filename ?? null };
	}
}
