import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdateExerciseDto } from "./dto/update-exercise.dto";
import { CreateExerciseDto } from "./dto/create-exercise.dto";
import { ResponseExerciseDto } from "./dto/response-exercise.dto";
import { FilterExerciseDto } from "./dto/filter-exercise.dto";
import { BaseService } from "src/base/base.service";
import { CollectionsService } from "src/collections/collections.service";
import { UsersService } from "src/users/users.service";
import { PaginatedResponseDto } from "src/common/types";
import { DrillIncomingAnswerDto, ResponseDrillQuestionDto, ResponseDrillResultDto } from "./dto/quiz.dto";
import { Exercise } from "@prisma/client";

@Injectable()
export class ExercisesService extends BaseService {
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
		private readonly collectionsService: CollectionsService
	) {
		super();
	}

	public async create(currentUserId: string, dto: CreateExerciseDto): Promise<ResponseExerciseDto> {
		const collection = await this.collectionsService.findCollection(dto.collectionId);
		const currentUser = await this.usersService.findUser(currentUserId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("You are not allowed to update this collection.");
		}

		const { additionalCorrectAnswers, correctAnswer, distractors, type } = dto;

		if (additionalCorrectAnswers?.some((a): boolean => a === correctAnswer)) {
			throw new ConflictException("Correct answer cannot be listed as an additional correct answer.");
		}

		if (
			additionalCorrectAnswers?.length &&
			new Set(additionalCorrectAnswers).size !== additionalCorrectAnswers.length
		) {
			throw new ConflictException("Additional correct answers must be unique");
		}

		// Distractor validation
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

		if (type === "CHOICE_SINGLE") {
			if (!distractors?.length || distractors.length < 10) {
				throw new ConflictException("At least 10 distractors are required for single-choice questions");
			}
		}

		const exercise = await this.prismaService.exercise.create({
			data: {
				question: dto.question,
				explanation: dto.explanation,
				correctAnswer: dto.correctAnswer,
				additionalCorrectAnswers: dto.additionalCorrectAnswers,
				collectionId: dto.collectionId,
				distractors: dto.distractors,
				type: dto.type,
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
			throw new ForbiddenException("You are not allowed to update this collection.");
		}

		const [exercises, total] = await Promise.all([
			this.prismaService.exercise.findMany({
				where: {
					collectionId: collectionId,
				},
				skip: filter.offset,
				take: filter.limit,
				orderBy: { createdAt: "desc" },
			}),
			this.prismaService.exercise.count({ where: { collectionId } }),
		]);

		return {
			data: this.toResponseDto(ResponseExerciseDto, exercises),
			pagination: this.createPaginationMeta(total, 0, filter.limit),
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
		dto: UpdateExerciseDto
	): Promise<ResponseExerciseDto> {
		const exercise = await this.findExercise(exerciseId);
		const currentUser = await this.usersService.findUser(currentUserId);
		const collection = await this.collectionsService.findCollection(exercise.collectionId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("Forbidden");
		}

		// No-op guard TODO
		// Build a safe exercise payload
		// Update and return DTO

		const updated = await this.prismaService.exercise.update({
			where: {
				id: exerciseId,
			},
			data: dto,
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
		// Delete
		// Check if delete success
		// Return result

		const deleted = await this.prismaService.exercise.delete({
			where: {
				id: exerciseId,
			},
		});

		return this.toResponseDto(ResponseExerciseDto, deleted);
	}

	/* Drill methods */
	public async getDrillExercise(currentUserId: string, collectionId: string): Promise<ResponseDrillQuestionDto> {
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

		return this.toResponseDto(ResponseDrillQuestionDto, exercise);
	}

	public async submitDrillAnswer(
		currentUserId: string,
		collectionId: string,
		dto: DrillIncomingAnswerDto
	): Promise<ResponseDrillResultDto> {
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
			nextExerciseId: nextExercise.exerciseId,
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
}
