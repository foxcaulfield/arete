import {
	ConflictException,
	ForbiddenException,
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
import { FilterExerciseDto } from "./dto/filter-exercise.dto";
import { BaseService } from "src/base/base.service";
import { CollectionsService } from "src/collections/collections.service";
import { UsersService } from "src/users/users.service";
import { PaginatedResponseDto } from "src/common/types";
import { UserAnswerDto, QuizQuestionDto, UserAnswerFeedbackDto } from "./dto/quiz.dto";
import { Exercise, ExerciseType, Prisma, Collection, User } from "@prisma/client";

import { ExerciseFileType } from "src/common/enums/exercise-file-type.enum";
import { FilesService } from "src/common/files.service";

interface UploadedFiles {
	audio?: Express.Multer.File[];
	image?: Express.Multer.File[];
}

@Injectable()
export class ExercisesService extends BaseService {
	private readonly logger = new Logger(ExercisesService.name);

	// Configuration constants
	private readonly distractorsMinLimit = 5;
	private readonly distractorInQuestionLimit = 3;
	private readonly maxDistractorLength = 50;
	private readonly minDistractorLength = 1;

	private readonly fileTypeToUrlPropMap = {
		[ExerciseFileType.AUDIO]: "audioUrl",
		[ExerciseFileType.IMAGE]: "imageUrl",
	} as const satisfies Record<ExerciseFileType, keyof Exercise>;

	public constructor(
		private readonly prismaService: PrismaService,
		private readonly usersService: UsersService,
		private readonly collectionsService: CollectionsService,
		private readonly filesService: FilesService
	) {
		super();
	}

	/* ===== PUBLIC METHODS ===== */

	public async create(
		currentUserId: string,
		dto: CreateExerciseDto,
		files?: UploadedFiles
	): Promise<ResponseExerciseDto> {
		await this.validateCollectionAccess(currentUserId, dto.collectionId);
		this.validateAnswersAndDistractors(dto.correctAnswer, dto.additionalCorrectAnswers, dto.distractors, dto.type);
		const upload = this.filesService.handleSingleFileUploads.bind(this.filesService);
		const { filename: audioFilename } = await upload(files?.audio?.[0], ExerciseFileType.AUDIO);
		const { filename: imageFilename } = await upload(files?.image?.[0], ExerciseFileType.IMAGE);

		try {
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
		const skip = (filter.page - 1) * filter.limit;
		await this.validateCollectionAccess(currentUserId, collectionId);

		const where: Prisma.ExerciseWhereInput = { collectionId };
		const total = await this.prismaService.exercise.count({ where });

		if (total === 0) {
			return {
				data: this.toResponseDto(ResponseExerciseDto, []),
				pagination: this.createPaginationMeta(total, filter.page, filter.limit),
			};
		}

		// const [exercises, total] = await Promise.all([
		// 	this.prismaService.exercise.findMany({
		// 		where,
		// 		skip,
		// 		take: filter.limit,
		// 		orderBy: { createdAt: "desc" },
		// 	}),
		// 	this.prismaService.exercise.count({ where }),
		// ]);

		const rows: Array<
			Exercise & {
				totalAttempts: number;
				correctAttempts: number;
			}
		> = await this.prismaService.$queryRaw(
			Prisma.sql`
            SELECT
				e.id,
                e.question,
                e."audioUrl"                               AS "audioUrl",
                e."imageUrl"                               AS "imageUrl",
                e.type                                     AS "type",
                e.translation                              AS "translation",
                e.explanation                              AS "explanation",
                e.distractors                              AS "distractors",
                e."collectionId"                           AS "collectionId",
                e."createdAt"                              AS "createdAt",
                e."updatedAt"                              AS "updatedAt",
                e."isActive"                               AS "isActive",
                e."additional_correct_answers"             AS "additionalCorrectAnswers",
                e."correct_answer"                         AS "correctAnswer",
                COALESCE(a.total, 0)    AS "totalAttempts",
                COALESCE(c.correct, 0)  AS "correctAttempts"
            FROM "exercises" e
            LEFT JOIN (
                SELECT "exerciseId", COUNT(*)::int AS total
                FROM "attempts"
                WHERE "userId" = ${currentUserId}
                GROUP BY "exerciseId"
            ) a ON e.id = a."exerciseId"
            LEFT JOIN (
                SELECT "exerciseId", COUNT(*)::int AS correct
                FROM "attempts"
                WHERE "userId" = ${currentUserId} AND "isCorrect" = true
                GROUP BY "exerciseId"
            ) c ON e.id = c."exerciseId"
            WHERE e."collectionId" = ${collectionId}
            ORDER BY COALESCE(a.total, 0) DESC NULLS LAST
            LIMIT ${filter.limit} OFFSET ${skip};
        `
		);

		return {
			data: this.toResponseDto(ResponseExerciseDto, rows),
			pagination: this.createPaginationMeta(total, filter.page, filter.limit),
		};
	}

	public async getExerciseById(currentUserId: string, exerciseId: string): Promise<ResponseExerciseDto> {
		const exercise = await this.findExerciseOrFail(exerciseId);
		await this.validateCollectionAccess(currentUserId, exercise.collectionId);

		return this.toResponseDto(ResponseExerciseDto, exercise);
	}

	public async update(
		currentUserId: string,
		exerciseId: string,
		dto: UpdateExerciseDto,
		files?: UploadedFiles
	): Promise<ResponseExerciseDto> {
		const exercise = await this.findExerciseOrFail(exerciseId);
		await this.validateCollectionAccess(currentUserId, exercise.collectionId);

		this.validateAnswersAndDistractors(
			dto.correctAnswer ?? exercise.correctAnswer,
			dto.additionalCorrectAnswers ?? exercise.additionalCorrectAnswers,
			dto.distractors ?? exercise.distractors,
			dto.type ?? exercise.type
		);

		const { filename: audioFilename } = await this.filesService.handleSingleFileUploads(
			files?.audio?.[0],
			ExerciseFileType.AUDIO,
			exercise.audioUrl,
			dto.setNullAudio
		);
		const { filename: imageFilename } = await this.filesService.handleSingleFileUploads(
			files?.image?.[0],
			ExerciseFileType.IMAGE,
			exercise.imageUrl,
			dto.setNullImage
		);

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
	}

	public async delete(currentUserId: string, exerciseId: string): Promise<ResponseExerciseDto> {
		const exercise = await this.findExerciseOrFail(exerciseId);
		await this.validateCollectionAccess(currentUserId, exercise.collectionId);

		// Delete associated files (non-blocking)
		await this.deleteExerciseFiles(exercise);

		const deleted = await this.prismaService.exercise.delete({
			where: { id: exerciseId },
		});

		this.logger.log(`Exercise deleted: ${exerciseId} by user ${currentUserId}`);
		return this.toResponseDto(ResponseExerciseDto, deleted);
	}

	/* ===== DRILL METHODS ===== */

	public async getDrillExercise(
		currentUserId: string,
		collectionId: string,
		exerciseSelectionMode: string = "random"
	): Promise<QuizQuestionDto> {
		await this.validateCollectionAccess(currentUserId, collectionId);

		let exercise: Exercise;
		if (exerciseSelectionMode === "least-attempted") {
			exercise = await this.getLeastAttemptedExercise(collectionId, currentUserId);
		} else {
			exercise = await this.getRandomActiveExercise(collectionId);
		}

		const updatedDistractors =
			exercise.type === ExerciseType.CHOICE_SINGLE
				? this.getRandomDistractors(exercise.correctAnswer, exercise.distractors ?? [])
				: [];

		return this.toResponseDto(QuizQuestionDto, {
			...exercise,
			distractors: updatedDistractors,
		});
	}

	public async submitDrillAnswer(
		currentUserId: string,
		collectionId: string,
		dto: UserAnswerDto
	): Promise<UserAnswerFeedbackDto> {
		await this.validateCollectionAccess(currentUserId, collectionId);

		const exercise = await this.findExerciseOrFail(dto.exerciseId);
		const isCorrect = this.checkAnswer(dto.userAnswer, exercise);

		// TODO: Uncomment when ready to track attempts
		await this.recordAttempt(currentUserId, exercise.id, isCorrect);

		const nextExercise = await this.getDrillExercise(currentUserId, collectionId);

		return {
			isCorrect,
			correctAnswer: exercise.correctAnswer,
			explanation: exercise.explanation ?? undefined,
			nextExerciseId: nextExercise.id,
		};
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

		await this.validateCollectionAccess(currentUserId, exercise.collectionId);

		return this.filesService.getFile({ filetype, filename });
	}

	/* ===== PRIVATE HELPER METHODS ===== */

	/**
	 * Validates user access to a collection and returns both collection and user
	 */
	private async validateCollectionAccess(
		userId: string,
		collectionId: string
	): Promise<{ collection: Collection; currentUser: User }> {
		const [collection, currentUser] = await Promise.all([
			this.collectionsService.findCollection(collectionId),
			this.usersService.findUser(userId),
		]);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("You are not allowed to access this collection");
		}

		return { collection, currentUser };
	}

	/**
	 * Finds an exercise by ID or throws NotFoundException
	 */
	private async findExerciseOrFail(id: string): Promise<Exercise> {
		const exercise = await this.prismaService.exercise.findUnique({
			where: { id },
		});

		if (!exercise) {
			throw new NotFoundException(`Exercise with ID ${id} not found`);
		}

		return exercise;
	}

	/**
	 * Validates answers and distractors for an exercise
	 */
	private validateAnswersAndDistractors(
		correctAnswer: string,
		additionalCorrectAnswers?: string[],
		distractors?: string[],
		type?: ExerciseType
	): void {
		// Validate correct answer isn't in additional answers
		if (additionalCorrectAnswers?.includes(correctAnswer)) {
			throw new ConflictException("Correct answer cannot be listed as an additional correct answer");
		}

		// Validate additional correct answers are unique
		if (additionalCorrectAnswers?.length) {
			const uniqueAnswers = new Set(additionalCorrectAnswers);
			if (uniqueAnswers.size !== additionalCorrectAnswers.length) {
				throw new ConflictException("Additional correct answers must be unique");
			}
		}

		// Validate distractors
		if (distractors?.length) {
			this.validateDistractors(distractors, correctAnswer, additionalCorrectAnswers);
		}

		// Validate minimum distractors for single-choice questions
		if (type === ExerciseType.CHOICE_SINGLE) {
			if (!distractors?.length || distractors.length < this.distractorsMinLimit) {
				throw new ConflictException(
					`At least ${this.distractorsMinLimit} distractors are required for single-choice questions`
				);
			}
		}
	}

	/**
	 * Validates distractor-specific rules
	 */
	private validateDistractors(
		distractors: string[],
		correctAnswer: string,
		additionalCorrectAnswers?: string[]
	): void {
		// Check uniqueness
		const uniqueDistractors = new Set(distractors);
		if (uniqueDistractors.size !== distractors.length) {
			throw new ConflictException("Distractors must be unique");
		}

		// Check against correct answer
		if (distractors.includes(correctAnswer)) {
			throw new ConflictException("Distractors cannot be the same as the correct answer");
		}

		// Check against additional correct answers
		if (additionalCorrectAnswers?.some((answer): boolean => distractors.includes(answer))) {
			throw new ConflictException("Distractors cannot be the same as any additional correct answer");
		}

		// Check length constraints
		const invalidDistractor = distractors.find(
			(d): boolean => d.length < this.minDistractorLength || d.length > this.maxDistractorLength
		);
		if (invalidDistractor) {
			throw new ConflictException(
				`Each distractor must be ${this.minDistractorLength}-${this.maxDistractorLength} characters`
			);
		}
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

	/**
	 * Retrieves a random active exercise from a collection
	 */
	private async getRandomActiveExercise(collectionId: string): Promise<Exercise> {
		const count = await this.prismaService.exercise.count({
			where: { collectionId, isActive: true },
		});

		if (count === 0) {
			throw new NotFoundException("No exercises available in this collection");
		}

		const offset = Math.floor(Math.random() * count);

		const exercise = await this.prismaService.exercise.findFirst({
			where: { collectionId, isActive: true },
			skip: offset,
			take: 1,
		});

		if (!exercise) {
			throw new NotFoundException("Exercise not found");
		}

		return exercise;
	}

	private async getLeastAttemptedExercise(collectionId: string, userId: string): Promise<Exercise> {
		const baseWhere = { collectionId, isActive: true };

		// // Global least-attempted (no user filter) — use relation count ordering
		// if (!userId) {
		// 	const exercise = await this.prismaService.exercise.findFirst({
		// 		where: baseWhere,
		// 		orderBy: { Attempt: { _count: "asc" } },
		// 	});

		// 	if (!exercise) throw new NotFoundException("Exercise not found");

		// 	return exercise;
		// }

		// Per-user: prefer any exercise with ZERO attempts by this user
		const zeroAttemptExercise = await this.prismaService.exercise.findFirst({
			where: {
				...baseWhere,
				Attempt: { none: { userId } }, // exercises with no attempts by this user
			},
		});
		if (zeroAttemptExercise) return zeroAttemptExercise;

		// Otherwise group attempts by exercise (only attempts by this user and in the collection),
		// pick exerciseId with minimal count and load that exercise.
		const grouped = await this.prismaService.attempt.groupBy({
			by: ["exerciseId"],
			where: {
				userId,
				exercise: { collectionId, isActive: true }, // restrict to the collection
			},
			_count: { _all: true },
		});

		if (grouped.length === 0) {
			throw new NotFoundException("No exercises available in this collection");
		}

		let min = grouped[0]!;
		for (const g of grouped) {
			if (g._count._all < min._count._all) min = g;
		}

		return this.findExerciseOrFail(min.exerciseId);
	}

	/**
	 * Mixes correct answer with random distractors
	 */
	private getRandomDistractors(correctAnswer: string, allDistractors: string[]): string[] {
		const selectedDistractors = this.shuffleArray([...allDistractors]).slice(0, this.distractorInQuestionLimit);
		return this.shuffleArray([...selectedDistractors, correctAnswer]);
	}

	/**
	 * Fisher-Yates shuffle algorithm
	 */
	private shuffleArray<T>(array: T[]): T[] {
		const shuffled = [...array];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			// ensure they are not undefined
			[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
		}
		return shuffled;
	}

	/**
	 * Checks if user's answer is correct (case-insensitive, trimmed)
	 */
	private checkAnswer(userAnswer: string, exercise: Exercise): boolean {
		const normalizedUserAnswer = this.normalize(userAnswer);
		const normalizedCorrectAnswer = this.normalize(exercise.correctAnswer);

		if (normalizedUserAnswer === normalizedCorrectAnswer) {
			return true;
		}

		if (exercise.additionalCorrectAnswers?.length) {
			return exercise.additionalCorrectAnswers.some(
				(alt): boolean => normalizedUserAnswer === this.normalize(alt)
			);
		}

		return false;
	}

	/**
	 * Normalizes answer for comparison (lowercase, trimmed)
	 */
	private normalize(answer: string): string {
		return answer.trim().toLowerCase();
	}

	/**
	 * Records user attempt (currently commented out in original)
	 */
	private async recordAttempt(userId: string, exerciseId: string, isCorrect: boolean): Promise<void> {
		await this.prismaService.attempt.create({
			data: {
				exerciseId,
				userId,
				isCorrect,
			},
		});
	}
}
