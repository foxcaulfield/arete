import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
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
import { Exercise, ExerciseType, Prisma } from "@prisma/client";
import { FileStorageService, StorageType } from "@getlarge/nestjs-tools-file-storage";
import { extname } from "path";
import { v4 as uuid4 } from "uuid";
import { ExerciseFileType } from "./enums/exercise-file-type.enum";

@Injectable()
export class ExercisesService extends BaseService {
	private readonly distractorsMinLimit = 5;

	/* Private helpers */
	private normalize(answer: string): string {
		return answer.trim().toLowerCase();
	}

	private async findExercise(id: string): Promise<Exercise> {
		const exercise = await this.prismaService.exercise.findFirst({
			where: { id },
			// include
		});

		if (!exercise) {
			throw new NotFoundException("Exercise not found");
		}

		return exercise;
	}

	public constructor(
		private readonly prismaService: PrismaService,
		private readonly usersService: UsersService,
		private readonly collectionsService: CollectionsService,
		private readonly fileStorageService: FileStorageService<StorageType.FS>
	) {
		super();
	}

	// Extracted common validation logic for answers and distractors
	private validateAnswersAndDistractors(
		correctAnswer: string,
		additionalCorrectAnswers?: string[],
		distractors?: string[],
		type?: ExerciseType
	): void {
		if (additionalCorrectAnswers?.some((a): boolean => a === correctAnswer)) {
			throw new ConflictException("Correct answer cannot be listed as an additional correct answer.");
		}

		if (
			additionalCorrectAnswers?.length &&
			new Set(additionalCorrectAnswers).size !== additionalCorrectAnswers.length
		) {
			throw new ConflictException("Additional correct answers must be unique");
		}

		if (distractors?.some((d): boolean => d === correctAnswer)) {
			throw new ConflictException("Distractors cannot be the same as the correct answer");
		}

		if (additionalCorrectAnswers?.some((a): boolean => !!distractors?.includes(a))) {
			throw new ConflictException("Distractors cannot be the same as any additional correct answer");
		}

		if (distractors?.length && new Set(distractors).size !== distractors.length) {
			throw new ConflictException("Distractors must be unique");
		}

		if (distractors?.some((dist): boolean => dist.length < 1 || dist.length > 50)) {
			throw new ConflictException("Each distractor must be 1-50 characters");
		}

		if (
			type === ExerciseType.CHOICE_SINGLE &&
			(!distractors?.length || distractors.length < this.distractorsMinLimit)
		) {
			throw new ConflictException(
				`At least ${this.distractorsMinLimit} distractors are required for single-choice questions`
			);
		}
	}

	// Extracted common file handling logic
	private async handleFileUploads(
		files: { audio?: Express.Multer.File[]; image?: Express.Multer.File[] } | undefined,
		previous?: { audioUrl?: string | null; imageUrl?: string | null }
	): Promise<{ audioFilename: string | null; imageFilename: string | null }> {
		const createFilenameForFile = (file: Express.Multer.File): string => {
			const extension = extname(file.originalname) || file.mimetype.split("/")[1];
			const safeExtension = extension && extension.startsWith(".") ? extension.slice(1) : extension;
			return uuid4() + (safeExtension ? `.${safeExtension}` : "");
		};

		const audioFile = files?.audio?.length ? files.audio[0] : null;
		const imageFile = files?.image?.length ? files.image[0] : null;

		const audioFilename = audioFile ? createFilenameForFile(audioFile) : null;
		const imageFilename = imageFile ? createFilenameForFile(imageFile) : null;

		try {
			// Delete previous files if new ones are uploaded
			if (audioFile && previous?.audioUrl) {
				await this.fileStorageService.deleteFile({
					filePath: `${this.fileTypeToFolderMap[ExerciseFileType.AUDIO]}/${previous.audioUrl}`,
				});
			}
			if (imageFile && previous?.imageUrl) {
				await this.fileStorageService.deleteFile({
					filePath: `${this.fileTypeToFolderMap[ExerciseFileType.IMAGE]}/${previous.imageUrl}`,
				});
			}
			if (audioFile && audioFilename) {
				await this.fileStorageService.uploadFile({
					content: audioFile.buffer,
					filePath: `${this.fileTypeToFolderMap[ExerciseFileType.AUDIO]}/${audioFilename}`,
				});
			}
			if (imageFile && imageFilename) {
				await this.fileStorageService.uploadFile({
					content: imageFile.buffer,
					filePath: `${this.fileTypeToFolderMap[ExerciseFileType.IMAGE]}/${imageFilename}`,
				});
			}
		} catch (error) {
			throw new BadRequestException(
				`File upload failed: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}

		return { audioFilename, imageFilename };
	}

	public async create(
		currentUserId: string,
		dto: CreateExerciseDto,
		files?: { audio?: Express.Multer.File[]; image?: Express.Multer.File[] }
	): Promise<ResponseExerciseDto> {
		const collection = await this.collectionsService.findCollection(dto.collectionId);
		const currentUser = await this.usersService.findUser(currentUserId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("You are not allowed to update this collection.");
		}

		this.validateAnswersAndDistractors(dto.correctAnswer, dto.additionalCorrectAnswers, dto.distractors, dto.type);

		const { audioFilename, imageFilename } = await this.handleFileUploads(files);

		const exercise = await this.prismaService.exercise.create({
			data: {
				question: dto.question,
				explanation: dto.explanation,
				correctAnswer: dto.correctAnswer,
				additionalCorrectAnswers: dto.additionalCorrectAnswers,
				collectionId: dto.collectionId,
				distractors: dto.distractors,
				type: dto.type,
				audioUrl: audioFilename,
				imageUrl: imageFilename,
			},
		});

		return this.toResponseDto(ResponseExerciseDto, exercise);
	}

	public async getExercisesInCollection(
		currentUserId: string,
		collectionId: string,
		filter: FilterExerciseDto
	): Promise<PaginatedResponseDto<ResponseExerciseDto>> {
		const collection = await this.collectionsService.findCollection(collectionId);
		const currentUser = await this.usersService.findUser(currentUserId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("Forbidden");
		}

		const where: Prisma.ExerciseWhereInput = { collectionId };

		const [exercises, total] = await Promise.all([
			this.prismaService.exercise.findMany({
				where,
				skip: filter.offset,
				take: filter.limit,
				orderBy: { createdAt: "desc" },
			}),
			this.prismaService.exercise.count({ where }),
		]);

		return {
			data: this.toResponseDto(ResponseExerciseDto, exercises),
			pagination: this.createPaginationMeta(total, filter.offset, filter.limit),
		};
	}

	public async getExerciseById(currentUserId: string, exerciseId: string): Promise<ResponseExerciseDto> {
		const exercise = await this.findExercise(exerciseId);
		const currentUser = await this.usersService.findUser(currentUserId);
		const collection = await this.collectionsService.findCollection(exercise.collectionId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("Forbidden");
		}

		return this.toResponseDto(ResponseExerciseDto, exercise);
	}

	public async update(
		currentUserId: string,
		exerciseId: string,
		dto: UpdateExerciseDto,
		files?: { audio?: Express.Multer.File[]; image?: Express.Multer.File[] }
	): Promise<ResponseExerciseDto> {
		const exercise = await this.findExercise(exerciseId);
		const currentUser = await this.usersService.findUser(currentUserId);
		const collection = await this.collectionsService.findCollection(exercise.collectionId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("Forbidden");
		}

		this.validateAnswersAndDistractors(
			dto.correctAnswer || exercise.correctAnswer,
			dto.additionalCorrectAnswers || exercise.additionalCorrectAnswers,
			dto.distractors || exercise.distractors,
			dto.type || exercise.type
		);

		const { audioFilename, imageFilename } = await this.handleFileUploads(files, {
			audioUrl: exercise.audioUrl,
			imageUrl: exercise.imageUrl,
		});

		const updated = await this.prismaService.exercise.update({
			where: {
				id: exerciseId,
			},
			data: {
				...dto,
				audioUrl: audioFilename || exercise.audioUrl,
				imageUrl: imageFilename || exercise.imageUrl,
			},
		});

		return this.toResponseDto(ResponseExerciseDto, updated);
	}

	public async delete(currentUserId: string, exerciseId: string): Promise<ResponseExerciseDto> {
		const exercise = await this.findExercise(exerciseId);
		const currentUser = await this.usersService.findUser(currentUserId);
		const collection = await this.collectionsService.findCollection(exercise.collectionId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("Forbidden");
		}

		// Delete associated files if present
		try {
			if (exercise.audioUrl) {
				await this.fileStorageService.deleteFile({
					filePath: `${this.fileTypeToFolderMap[ExerciseFileType.AUDIO]}/${exercise.audioUrl}`,
				});
			}
			if (exercise.imageUrl) {
				await this.fileStorageService.deleteFile({
					filePath: `${this.fileTypeToFolderMap[ExerciseFileType.IMAGE]}/${exercise.imageUrl}`,
				});
			}
		} catch (error) {
			// Log error but continue with DB deletion
			console.error(
				`Failed to delete associated files for exercise ${exerciseId}: ${
					error instanceof Error ? error.message : "Unknown error"
				}`
			);
		}

		const deleted = await this.prismaService.exercise.delete({
			where: {
				id: exerciseId,
			},
		});

		return this.toResponseDto(ResponseExerciseDto, deleted);
	}

	private readonly distractorLimit = 3;

	// mix correct answer with random distractors
	private getRandomDistractors(correctAnswer: string, allDistractors: string[]): string[] {
		const shuffled = allDistractors
			.sort((): number => 0.5 - Math.random())
			.slice(0, this.distractorLimit)
			.concat(correctAnswer)
			.sort((): number => 0.5 - Math.random());
		return shuffled;
	}

	/* Drill methods */
	public async getDrillExercise(currentUserId: string, collectionId: string): Promise<QuizQuestionDto> {
		const currentUser = await this.usersService.findUser(currentUserId);
		const collection = await this.collectionsService.findCollection(collectionId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("User is not allowed to access this collection");
		}

		const count = await this.prismaService.exercise.count({
			where: { collectionId: collectionId, isActive: true },
		});

		if (!count) {
			throw new NotFoundException("No exercises available in this collection");
		}

		const offset = Math.floor(Math.random() * count);

		const exercise = await this.prismaService.exercise.findFirst({
			where: {
				collectionId: collectionId,
				isActive: true,
			},
			skip: offset,
			take: 1,
		});

		if (!exercise) {
			throw new NotFoundException("Exercise not found");
		}

		const updatedDistractors =
			exercise.type === ExerciseType.CHOICE_SINGLE
				? this.getRandomDistractors(exercise.correctAnswer, exercise.distractors || [])
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
		const collection = await this.collectionsService.findCollection(collectionId);
		const currentUser = await this.usersService.findUser(currentUserId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("User is not allowed to access this collection");
		}

		const exercise = await this.findExercise(dto.exerciseId);

		const isCorrect = this.checkAnswer(dto.userAnswer, exercise);

		// await this.prismaService.attempt.create({
		// 	data: {
		// 		exerciseId: exercise.id,
		// 		userId: currentUser.id,
		// 		isCorrect: isCorrect,
		// 	},
		// });

		const nextExercise = await this.getDrillExercise(currentUserId, collectionId);

		return {
			isCorrect: isCorrect,
			correctAnswer: exercise.correctAnswer,
			explanation: exercise.explanation || undefined,
			nextExerciseId: nextExercise.id,
		};
	}

	private checkAnswer(userAnswer: string, { correctAnswer, additionalCorrectAnswers }: Exercise): boolean {
		const normalizedUserAnswer = this.normalize(userAnswer);
		const normalizedCorrectAnswer = this.normalize(correctAnswer);

		if (normalizedUserAnswer === normalizedCorrectAnswer) {
			return true;
		}

		if (additionalCorrectAnswers?.length) {
			return additionalCorrectAnswers.some((alt): boolean => normalizedUserAnswer === this.normalize(alt));
		}

		return false;
	}

	private readonly fileTypeToUrlPropMap = {
		[ExerciseFileType.AUDIO]: "audioUrl",
		[ExerciseFileType.IMAGE]: "imageUrl",
	} as const satisfies Record<ExerciseFileType, keyof Exercise>;

	private readonly fileTypeToFolderMap = {
		[ExerciseFileType.AUDIO]: "audio",
		[ExerciseFileType.IMAGE]: "images",
	} as const;

	private readonly mimeTypeMap = {
		[ExerciseFileType.AUDIO]: "audio/mpeg",
		[ExerciseFileType.IMAGE]: "image/jpeg",
	} as const satisfies Record<ExerciseFileType, string>;

	public async getExerciseFile(
		currentUserId: string,
		filename: string,
		filetype: ExerciseFileType
	): Promise<StreamableFile> {
		const currentUser = await this.usersService.findUser(currentUserId);

		const fileNameProp = this.fileTypeToUrlPropMap[filetype];

		const exercise = await this.prismaService.exercise.findFirst({
			where: {
				[fileNameProp]: filename,
			},
		});

		if (!exercise) {
			throw new NotFoundException("Exercise not found for the given file");
		}
		const collection = await this.collectionsService.findCollection(exercise.collectionId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("User is not allowed to access this collection");
		}

		const folder = this.fileTypeToFolderMap[filetype];

		if (!folder) {
			throw new BadRequestException("Invalid file type");
		}

		const stream = await this.fileStorageService.downloadStream({
			filePath: `${folder}/${filename}`,
		});

		return new StreamableFile(stream, {
			type: this.mimeTypeMap[filetype],
		});
	}
}
