import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Exercise, ExerciseType } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { ExercisesService } from "./exercises.service";
import { QuizQuestionDto, UserAnswerDto, UserAnswerFeedbackDto, CollectionStatsDto } from "./dto/quiz.dto";
import { BaseService } from "src/base/base.service";
import { UtilsService } from "src/common/utils.service";
import { ExerciseQueryService } from "./exercise-query.service";
import { EXERCISE_RULES_SYMBOL, type ExerciseRulesConfig } from "src/exercises/exercise-rules.config";
import { CollectionAccessService } from "src/collections/collection-access.service";
import { QUIZ_SESSION_STORE, type IQuizSessionStore, type QuizSessionStats } from "./quiz-session.store";
import { parseJsonArray } from "src/common/json-array";
import { SrsService } from "src/srs/srs.service";

@Injectable()
export class QuizService extends BaseService {
	public constructor(
		private readonly prismaService: PrismaService,
		private readonly exercisesService: ExercisesService,
		private readonly collectionAccessService: CollectionAccessService,
		private readonly utilsService: UtilsService,
		private readonly exerciseQueryService: ExerciseQueryService,
		private readonly srsService: SrsService,
		@Inject(EXERCISE_RULES_SYMBOL) private readonly exerciseConfig: ExerciseRulesConfig,
		@Inject(QUIZ_SESSION_STORE) private readonly sessionStore: IQuizSessionStore
	) {
		super();
	}

	public resetSession(userId: string, collectionId: string): void {
		this.sessionStore.resetSession(userId, collectionId);
	}

	public getSessionStats(userId: string, collectionId: string): QuizSessionStats {
		return this.sessionStore.getSessionStats(userId, collectionId);
	}

	private async recordAttempt(userId: string, exerciseId: string, answer: string, isCorrect: boolean): Promise<void> {
		await this.prismaService.attempt.create({
			data: {
				exerciseId,
				userId,
				answer,
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

		const additionalAnswers = parseJsonArray(exercise.additionalCorrectAnswers);
		if (additionalAnswers.length > 0) {
			return additionalAnswers.some(
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
		await this.collectionAccessService.validateCollectionStudyAccess(currentUserId, collectionId);

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
		if (exerciseSelectionMode === "due") {
			const due = await this.srsService.getDueExercises(currentUserId, collectionId, 1, 0);
			if (due.length === 0) {
				throw new NotFoundException("No exercises due for review in this collection");
			}
			exercise = due[0]!;
		} else if (exerciseSelectionMode === "least-attempted") {
			exercise = await this.exerciseQueryService.getLeastAttemptedExercise(collectionId, currentUserId);
		} else {
			exercise = await this.exerciseQueryService.getRandomActiveExercise(collectionId);
		}

		const updatedDistractors =
			exercise.type === ExerciseType.CHOICE_SINGLE
				? this.getRandomDistractors(exercise.correctAnswer, parseJsonArray(exercise.distractors))
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
		await this.collectionAccessService.validateCollectionStudyAccess(currentUserId, collectionId);

		const exercise = await this.exercisesService.findExerciseOrFail(dto.exerciseId);
		const isCorrect = this.checkAnswer(dto.userAnswer, exercise);

		const sessionStats = this.sessionStore.recordAnswer(currentUserId, collectionId, exercise.id, isCorrect);
		await this.recordAttempt(currentUserId, exercise.id, dto.userAnswer, isCorrect);
		const cardState = await this.srsService.scheduleReview(currentUserId, exercise.id, isCorrect);

		return {
			isCorrect,
			correctAnswer: exercise.correctAnswer,
			explanation: exercise.explanation ?? undefined,
			additionalCorrectAnswers: parseJsonArray(exercise.additionalCorrectAnswers),
			streak: sessionStats.streak,
			sessionCorrect: sessionStats.correct,
			sessionTotal: sessionStats.total,
			nextReviewAt: cardState.nextReviewAt,
		};
	}

	/**
	 * Persistent lifetime stats for the current user on a given collection.
	 * Computed from the `Attempt` table — survives server restarts, no
	 * in-memory store involved. Streak and maxStreak are derived by walking
	 * the attempts in `createdAt ASC` order.
	 *
	 * Requires STUDY access (same as drill). VIEW-only users can't answer,
	 * so stats are meaningless for them.
	 */
	public async getCollectionStats(currentUserId: string, collectionId: string): Promise<CollectionStatsDto> {
		await this.collectionAccessService.validateCollectionStudyAccess(currentUserId, collectionId);

		const [totalExercises, exercisesWithAttempts, attempts] = await Promise.all([
			this.prismaService.exercise.count({ where: { collectionId, isActive: true } }),
			this.prismaService.exercise.count({
				where: {
					collectionId,
					isActive: true,
					Attempt: { some: { userId: currentUserId } },
				},
			}),
			this.prismaService.attempt.findMany({
				where: {
					userId: currentUserId,
					exercise: { collectionId, isActive: true },
				},
				select: { isCorrect: true },
				orderBy: { createdAt: "asc" },
			}),
		]);

		const totalAttempts = attempts.length;
		const correctAttempts = attempts.filter((a): boolean => a.isCorrect).length;
		const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;

		let streak = 0;
		let maxStreak = 0;
		let current = 0;
		for (const a of attempts) {
			if (a.isCorrect) {
				current++;
				if (current > maxStreak) maxStreak = current;
			} else {
				current = 0;
			}
		}
		streak = current;

		return this.toResponseDto(CollectionStatsDto, {
			totalExercises,
			exercisesWithAttempts,
			totalAttempts,
			correctAttempts,
			accuracy,
			streak,
			maxStreak,
		});
	}
}
