/// <reference types="multer" />
import { parseJsonArray, serializeJsonArray } from "src/common/json-array";
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
import type { MyAccessLevel } from "src/collections/dto/response-collection.dto";
import { caseInsensitiveContains } from "src/common/prisma-filters";

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
		await this.collectionAccessService.validateExerciseWriteAccess(currentUserId, dto.collectionId);

		// Check exercise limit for non-admin users
		const user = await this.prismaService.user.findUnique({ where: { id: currentUserId }, select: { role: true } });
		if (user?.role !== UserRole.ADMIN) {
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
					additionalCorrectAnswers: serializeJsonArray(rest.additionalCorrectAnswers),
					distractors: serializeJsonArray(rest.distractors),
					collection: {
						connect: { id: collectionId },
					},
				},
			});

			this.logger.log(`Exercise created: ${exercise.id} by user ${currentUserId}`);
			return this.toResponseDto(ResponseExerciseDto, {
				...exercise,
				distractors: parseJsonArray(exercise.distractors),
				additionalCorrectAnswers: parseJsonArray(exercise.additionalCorrectAnswers),
			});
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
		const { collection, currentUser } = await this.collectionAccessService.validateCollectionReadAccess(
			currentUserId,
			collectionId
		);

		// Resolve caller's effective access level (single source of truth) and
		// decide whether answers may be revealed. STUDY / VIEW get sanitized rows
		// (correctAnswer / additionalCorrectAnswers / distractors / explanation
		// stripped) so nothing leaks into the browser Network tab.
		const myAccessLevel = await this.collectionAccessService.resolveAccessLevel(
			currentUserId,
			collection,
			currentUser
		);
		const canSeeAnswers = myAccessLevel === "OWNER" || myAccessLevel === "ADMIN" || myAccessLevel === "EDIT";

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

		const searchTerm = search?.trim() || undefined;

		const where: Prisma.ExerciseWhereInput = {
			collectionId,
			...(searchTerm && {
				OR: [
					{ question: caseInsensitiveContains(searchTerm) },
					{ correctAnswer: caseInsensitiveContains(searchTerm) },
					{ translation: caseInsensitiveContains(searchTerm) },
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

		// Path 1: search / filter — standard Prisma query
		if (searchTerm || type || hasImage || hasAudio) {
			const exercises = await this.prismaService.exercise.findMany({
				where,
				skip,
				take: limit,
				orderBy:
					sortBy === ExerciseSortBy.TOTAL_ATTEMPTS || sortBy === ExerciseSortBy.MOST_FAILED
						? { createdAt: sortOrder } // fallback: raw sort unavailable when filters active
						: { [sortBy]: sortOrder },
			});

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
				return {
					...e,
					distractors: parseJsonArray(e.distractors),
					additionalCorrectAnswers: parseJsonArray(e.additionalCorrectAnswers),
					totalAttempts,
					correctAttempts,
				};
			});

			const dtos = this.toResponseDto(ResponseExerciseDto, enriched);
			return this.paginationService.buildPaginatedResponse(
				this.sanitizeExercisesForReadOnly(dtos, canSeeAnswers, myAccessLevel),
				total,
				page,
				limit
			);
		}

		// Path 2: optimized raw query for attempt-based sorts
		if (sortBy === ExerciseSortBy.TOTAL_ATTEMPTS || sortBy === ExerciseSortBy.MOST_FAILED) {
			const rows: Array<
				Exercise & {
					totalAttempts: number;
					correctAttempts: number;
				}
			> =
				sortBy === ExerciseSortBy.MOST_FAILED
					? await this.exerciseQueryService.getMostFailedExercises(collectionId, currentUserId, limit, skip)
					: await this.exerciseQueryService.getTopMostAttemptedExercises(
							collectionId,
							currentUserId,
							limit,
							skip,
							sortOrder
						);
			const parsedRows = rows.map((r): ResponseExerciseDto => ({
				...r,
				distractors: parseJsonArray(r.distractors),
				additionalCorrectAnswers: parseJsonArray(r.additionalCorrectAnswers),
			}));
			const dtos = this.toResponseDto(ResponseExerciseDto, parsedRows);
			return this.paginationService.buildPaginatedResponse(
				this.sanitizeExercisesForReadOnly(dtos, canSeeAnswers, myAccessLevel),
				total,
				page,
				limit
			);
		}

		// Path 3: default — Prisma query with sort, enrich with attempt counts
		const exercises = await this.prismaService.exercise.findMany({
			where,
			skip,
			take: limit,
			orderBy: { [sortBy]: sortOrder },
		});

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
			return {
				...e,
				distractors: parseJsonArray(e.distractors),
				additionalCorrectAnswers: parseJsonArray(e.additionalCorrectAnswers),
				totalAttempts,
				correctAttempts,
			};
		});

		const dtos = this.toResponseDto(ResponseExerciseDto, enriched);
		return this.paginationService.buildPaginatedResponse(
			this.sanitizeExercisesForReadOnly(dtos, canSeeAnswers, myAccessLevel),
			total,
			page,
			limit
		);
	}

	/**
	 * Single-exercise fetch, **edit-only** (OWNER | ADMIN | EDIT).
	 *
	 * STUDY / VIEW callers get 403 BEFORE reaching the sanitizer path —
	 * they never see the response, so no answer-stripping is needed here.
	 * Contrast with getExercisesInCollection, which is ReadAccess and must
	 * strip `correctAnswer` / `additionalCorrectAnswers` / `distractors` /
	 * `explanation` for STUDY / VIEW.
	 *
	 * If this endpoint is ever opened to read-only callers (e.g. a preview
	 * feature), switch to validateCollectionReadAccess AND route the return
	 * through applyStudyViewFilter with canSeeAnswers=false — otherwise
	 * answers leak via the Network tab.
	 */
	public async getExerciseById(currentUserId: string, exerciseId: string): Promise<ResponseExerciseDto> {
		const exercise = await this.findExerciseOrFail(exerciseId);

		const { collection, currentUser } = await this.collectionAccessService.validateExerciseWriteAccess(
			currentUserId,
			exercise.collectionId
		);

		const myAccessLevel = await this.collectionAccessService.resolveAccessLevel(
			currentUserId,
			collection,
			currentUser
		);

		const attemptStats = await this.prismaService.attempt.groupBy({
			by: ["isCorrect"],
			where: { userId: currentUserId, exerciseId },
			_count: { id: true },
		});

		const totalAttempts = attemptStats.reduce((sum, a): number => sum + a._count.id, 0);
		const correctAttempts = attemptStats.find((a): boolean => a.isCorrect)?._count.id || 0;

		const lastAttempt = await this.prismaService.attempt.findFirst({
			where: { userId: currentUserId, exerciseId },
			orderBy: { createdAt: "desc" },
			select: { createdAt: true },
		});

		return this.toResponseDto(ResponseExerciseDto, {
			...exercise,
			distractors: parseJsonArray(exercise.distractors),
			additionalCorrectAnswers: parseJsonArray(exercise.additionalCorrectAnswers),
			totalAttempts,
			correctAttempts,
			lastAttemptAt: lastAttempt?.createdAt || null,
			myAccessLevel,
		});
	}

	public async update(
		currentUserId: string,
		exerciseId: string,
		dto: UpdateExerciseDto,
		files?: UploadedFiles
	): Promise<ResponseExerciseDto> {
		const exercise = await this.findExerciseOrFail(exerciseId);
		await this.collectionAccessService.validateExerciseWriteAccess(currentUserId, exercise.collectionId);

		this.exerciseValidationService.validateAnswersAndDistractors(
			dto.correctAnswer ?? exercise.correctAnswer,
			dto.additionalCorrectAnswers ?? parseJsonArray(exercise.additionalCorrectAnswers),
			dto.distractors ?? parseJsonArray(exercise.distractors),
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
					additionalCorrectAnswers:
						dto.additionalCorrectAnswers === undefined
							? undefined
							: serializeJsonArray(dto.additionalCorrectAnswers),
					distractors: dto.distractors === undefined ? undefined : serializeJsonArray(dto.distractors),
					audioUrl: audioFilename,
					imageUrl: imageFilename,
				},
			});

			this.logger.log(`Exercise updated: ${exerciseId} by user ${currentUserId}`);
			return this.toResponseDto(ResponseExerciseDto, {
				...updated,
				distractors: parseJsonArray(updated.distractors),
				additionalCorrectAnswers: parseJsonArray(updated.additionalCorrectAnswers),
			});
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
		await this.collectionAccessService.validateExerciseWriteAccess(currentUserId, exercise.collectionId);

		await this.deleteExerciseFiles(exercise);

		const deleted = await this.prismaService.exercise.delete({
			where: { id: exerciseId },
		});

		this.logger.log(`Exercise deleted: ${exerciseId} by user ${currentUserId}`);
		return this.toResponseDto(ResponseExerciseDto, {
			...deleted,
			distractors: parseJsonArray(deleted.distractors),
			additionalCorrectAnswers: parseJsonArray(deleted.additionalCorrectAnswers),
		});
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

		await this.collectionAccessService.validateCollectionReadAccess(currentUserId, exercise.collectionId);

		return this.filesService.getFile({ filetype, filename });
	}

	/* ===== PRIVATE HELPER METHODS ===== */

	/**
	 * Applies the "study view" filter to a batch of exercise DTOs.
	 *
	 * - Always attaches `myAccessLevel` so the frontend can derive UI gates.
	 * - When `canSeeAnswers` is false (STUDY / VIEW), strips the fields that
	 *   would otherwise expose the answer: `correctAnswer`,
	 *   `additionalCorrectAnswers`, `distractors`, `explanation`.
	 *
	 * Defense-in-depth alongside `<ExercisesTable showAnswers={canEditExercises} />`
	 * — even if a STUDY user calls the endpoint directly, they get stripped rows.
	 */
	private sanitizeExercisesForReadOnly(
		dtos: ResponseExerciseDto[],
		canSeeAnswers: boolean,
		myAccessLevel: MyAccessLevel | null
	): ResponseExerciseDto[] {
		if (canSeeAnswers) {
			return dtos.map((d): ResponseExerciseDto => ({ ...d, myAccessLevel }));
		}
		return dtos.map((d): ResponseExerciseDto => ({
			...d,
			myAccessLevel,
			correctAnswer: null,
			additionalCorrectAnswers: null,
			distractors: null,
			explanation: null,
		}));
	}

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

	private async deleteExerciseFiles(exercise: Exercise): Promise<void> {
		const deletionPromises: Promise<void>[] = [];

		if (exercise.audioUrl) {
			deletionPromises.push(this.filesService.deleteFile(ExerciseFileType.AUDIO, exercise.audioUrl));
		}
		if (exercise.imageUrl) {
			deletionPromises.push(this.filesService.deleteFile(ExerciseFileType.IMAGE, exercise.imageUrl));
		}

		const results = await Promise.allSettled(deletionPromises);

		results.forEach((result, index): void => {
			if (result.status === "rejected") {
				const fileType = index === 0 ? "audio" : "image";
				this.logger.error(`Failed to delete ${fileType} file for exercise ${exercise.id}`, result.reason);
			}
		});
	}

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

	// В ExercisesService
	public toPublicExerciseDto(exercise: Exercise): Partial<ResponseExerciseDto> {
		return {
			id: exercise.id,
			question: exercise.question,
			audioUrl: exercise.audioUrl,
			imageUrl: exercise.imageUrl,
			type: exercise.type,
			translation: exercise.translation,
			explanation: exercise.explanation,
			distractors: parseJsonArray(exercise.distractors),
			collectionId: exercise.collectionId,
			createdAt: exercise.createdAt,
			updatedAt: exercise.updatedAt,
			isActive: exercise.isActive,
			additionalCorrectAnswers: parseJsonArray(exercise.additionalCorrectAnswers),
			correctAnswer: exercise.correctAnswer,
			totalAttempts: 0,
			correctAttempts: 0,
		};
	}
}
