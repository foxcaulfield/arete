import { Inject, Injectable } from "@nestjs/common";
import { Exercise, ExerciseType } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { ExercisesService } from "./exercises.service";
import { QuizQuestionDto, UserAnswerDto, UserAnswerFeedbackDto } from "./dto/quiz.dto";
import { BaseService } from "src/base/base.service";
import { UtilsService } from "src/common/utils.service";
import { ExerciseQueryService } from "./exercise-query.service";
import { EXERCISE_RULES_SYMBOL, type ExerciseRulesConfig } from "src/exercises/exercise-rules.config";
import { CollectionAccessService } from "src/collections/collection-access.service";

@Injectable()
export class QuizService extends BaseService {
	public constructor(
		private readonly prismaService: PrismaService,
		private readonly exercisesService: ExercisesService,
		private readonly collectionAccessService: CollectionAccessService,
		private readonly utilsService: UtilsService,
		private readonly exerciseQueryService: ExerciseQueryService,
		@Inject(EXERCISE_RULES_SYMBOL) private readonly exerciseConfig: ExerciseRulesConfig
	) {
		super();
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

	/**
	 * Checks if user's answer is correct (case-insensitive, trimmed)
	 */
	private checkAnswer(userAnswer: string, exercise: Exercise): boolean {
		const normalizedUserAnswer = this.utilsService.trimAndLowercase(userAnswer);
		const normalizedCorrectAnswer = this.utilsService.trimAndLowercase(exercise.correctAnswer);

		if (normalizedUserAnswer === normalizedCorrectAnswer) {
			return true;
		}

		if (exercise.additionalCorrectAnswers?.length) {
			return exercise.additionalCorrectAnswers.some(
				(alt): boolean => normalizedUserAnswer === this.utilsService.trimAndLowercase(alt)
			);
		}

		return false;
	}

	/**
	 * Mixes correct answer with random distractors
	 */
	private getRandomDistractors(correctAnswer: string, allDistractors: string[]): string[] {
		const selectedDistractors = this.utilsService
			.shuffleArray([...allDistractors])
			.slice(0, this.exerciseConfig.DISTRACTORS_PER_QUESTION);
		return this.utilsService.shuffleArray([...selectedDistractors, correctAnswer]);
	}

	/* ===== DRILL METHODS ===== */

	public async getDrillExercise(
		currentUserId: string,
		collectionId: string,
		exerciseSelectionMode: string = "random"
	): Promise<QuizQuestionDto> {
		await this.collectionAccessService.validateCollectionAccess(currentUserId, collectionId);

		let exercise: Exercise;
		if (exerciseSelectionMode === "least-attempted") {
			exercise = await this.exerciseQueryService.getLeastAttemptedExercise(collectionId, currentUserId);
		} else {
			exercise = await this.exerciseQueryService.getRandomActiveExercise(collectionId);
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
		await this.collectionAccessService.validateCollectionAccess(currentUserId, collectionId);

		const exercise = await this.exercisesService.findExerciseOrFail(dto.exerciseId);
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
}
