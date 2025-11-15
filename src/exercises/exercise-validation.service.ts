import { ConflictException, Injectable } from "@nestjs/common";
import { ExerciseType } from "@prisma/client";

@Injectable()
export class ExerciseValidationService {
	public readonly distractorsMinLimit = 5;
	public readonly maxDistractorLength = 50;
	public readonly minDistractorLength = 1;

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
}
