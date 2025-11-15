import {
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
import { Exercise, Prisma, Collection, User } from "@prisma/client";

import { ExerciseFileType } from "src/common/enums/exercise-file-type.enum";
import { FilesService } from "src/common/files.service";
import { ExerciseQueryService } from "./exercise-query.service";
import { ExerciseValidationService } from "./exercise-validation.service";

type MulterFile = Express.Multer.File;

interface UploadedFiles {
	audio?: MulterFile[];
	image?: MulterFile[];
}

@Injectable()
export class ExercisesService extends BaseService {
	private readonly logger = new Logger(ExercisesService.name);

	// Configuration constants
	public readonly distractorInQuestionLimit = 3;

	private readonly fileTypeToUrlPropMap = {
		[ExerciseFileType.AUDIO]: "audioUrl",
		[ExerciseFileType.IMAGE]: "imageUrl",
	} as const satisfies Record<ExerciseFileType, keyof Exercise>;

	public constructor(
		private readonly prismaService: PrismaService,
		private readonly usersService: UsersService,
		private readonly collectionsService: CollectionsService,
		private readonly filesService: FilesService,
		private readonly exerciseQueryService: ExerciseQueryService,
		private readonly exerciseValidationService: ExerciseValidationService
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
		> = await this.exerciseQueryService.getTopMostAttemptedExercises(
			collectionId,
			currentUserId,
			filter.limit,
			skip
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
		await this.validateCollectionAccess(currentUserId, exercise.collectionId);

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
