import { ExerciseType } from "@prisma/client";
import { Expose } from "class-transformer";
import { IsNotEmpty, IsString, IsOptional } from "class-validator";

export class QuizQuestionDto {
	@Expose()
	public id!: string;

	@Expose()
	public question!: string;

	@Expose()
	public audioUrl?: string | null;

	@Expose()
	public imageUrl?: string | null;

	@Expose()
	public type!: ExerciseType;

	@Expose()
	public translation?: string | null;

	@Expose()
	public explanation?: string | null;

	@Expose()
	public distractors?: string[] | null;

	@Expose()
	public totalExercises?: number;

	@Expose()
	public exercisesWithAttempts?: number;
}

export class UserAnswerDto {
	@IsString()
	@IsNotEmpty()
	public exerciseId!: string;

	@IsString()
	@IsNotEmpty()
	public userAnswer!: string;

	// @IsOptional()
	// @IsString()
	// public sessionId?: string;
}

export class UserAnswerFeedbackDto {
	@Expose()
	public isCorrect!: boolean;

	@Expose()
	public correctAnswer!: string;

	@Expose()
	public explanation?: string;

	@Expose()
	public additionalCorrectAnswers?: string[];

	// @Expose()
	// public streak?: number;

	// @Expose()
	// public sessionCorrect?: number;

	// @Expose()
	// public sessionTotal?: number;

	@Expose()
	public nextExerciseId!: string;
}
