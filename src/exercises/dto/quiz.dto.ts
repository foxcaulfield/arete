// import { Optional } from "@nestjs/common";
import { ExerciseType } from "@prisma/client";
import { Expose } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";

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
}

export class UserAnswerDto {
	@IsString()
	@IsNotEmpty()
	public exerciseId!: string;

	@IsString()
	@IsNotEmpty()
	public userAnswer!: string;
}

export class UserAnswerFeedbackDto {
	@Expose()
	public isCorrect!: boolean;

	@Expose()
	public correctAnswer!: string;

	@Expose()
	public explanation?: string;

	@Expose()
	public nextExerciseId!: string;
}
