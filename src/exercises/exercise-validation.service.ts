import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { ExerciseType } from "@prisma/client";
import { EXERCISE_RULES_SYMBOL, type ExerciseRulesConfig } from "src/exercises/ExerciseRulesConfig";

@Injectable()
export class ExerciseValidationService {
	public constructor(@Inject(EXERCISE_RULES_SYMBOL) private readonly exerciseConfig: ExerciseRulesConfig) {}
	/**
	 * Validates answers and distractors for an exercise
	 */
	public validateAnswersAndDistractors(
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
			if (!distractors?.length || distractors.length < this.exerciseConfig.MIN_DISTRACTORS_FOR_EXERCISE) {
				throw new ConflictException(
					`At least ${this.exerciseConfig.MIN_DISTRACTORS_FOR_EXERCISE} distractors are required for single-choice questions`
				);
			}
		}
	}

	/**
	 * Validates distractor-specific rules
	 */
	public validateDistractors(
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

		const minLen = this.exerciseConfig.MIN_DISTRACTOR_CHAR_LENGTH;
		const maxLen = this.exerciseConfig.MAX_DISTRACTOR_CHAR_LENGTH;
		// Check length constraints
		const invalidDistractor = distractors.find((d): boolean => d.length < minLen || d.length > maxLen);
		if (invalidDistractor) {
			throw new ConflictException(`Each distractor must be ${minLen}-${maxLen} characters`);
		}
	}
}
