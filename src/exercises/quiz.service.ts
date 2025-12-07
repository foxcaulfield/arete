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
// import { QuizSessionStore } from "./quiz-session.store";


@Injectable()
export class QuizService extends BaseService {
	public constructor(
		private readonly prismaService: PrismaService,
		private readonly exercisesService: ExercisesService,
		private readonly collectionAccessService: CollectionAccessService,
		private readonly utilsService: UtilsService,
		private readonly exerciseQueryService: ExerciseQueryService,
		@Inject(EXERCISE_RULES_SYMBOL) private readonly exerciseConfig: ExerciseRulesConfig,
		// private readonly sessionStore: QuizSessionStore,
	) {
		super();
	}
    

	/**
	 * Get or create a quiz session for user+collection
	 */
	// Session methods now delegated to `QuizSessionStore`
	public resetSession(_userId: string, _collectionId: string): void {
		// this.sessionStore.resetSession(userId, collectionId);
	}

	public getSessionStats(_userId: string, _collectionId: string): { correct: number; total: number; streak: number; maxStreak: number } {
		// return this.sessionStore.getSessionStats(userId, collectionId);
		return { correct: 0, total: 0, streak: 0, maxStreak: 0 };
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

		// Get collection stats
		const [totalExercises, exercisesWithAttempts] = await Promise.all([
			this.prismaService.exercise.count({ where: { collectionId, isActive: true } }),
			this.prismaService.exercise.count({
				where: {
					collectionId,
					isActive: true,
					Attempt: { some: { userId: currentUserId } },
				},
			}),
		]);

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
			totalExercises,
			exercisesWithAttempts,
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

		// Update session stats
		// const session = this.sessionStore.getOrCreateSession(currentUserId, collectionId);
		// session.total++;
		// session.answeredExerciseIds.add(exercise.id);
		
		// if (isCorrect) {
		// 	session.correct++;
		// 	session.streak++;
		// 	if (session.streak > session.maxStreak) {
		// 		session.maxStreak = session.streak;
		// 	}
		// } else {
		// 	session.streak = 0;
		// }

		// Record attempt in database
		await this.recordAttempt(currentUserId, exercise.id, isCorrect);

		const nextExercise = await this.getDrillExercise(currentUserId, collectionId);

		return {
			isCorrect,
			correctAnswer: exercise.correctAnswer,
			explanation: exercise.explanation ?? undefined,
			additionalCorrectAnswers: exercise.additionalCorrectAnswers ?? undefined,
			// streak: session.streak,
			// sessionCorrect: session.correct,
			// sessionTotal: session.total,
			nextExerciseId: nextExercise.id,
		};
	}
}
