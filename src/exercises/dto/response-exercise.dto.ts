import { ExerciseType } from "@prisma/client";
import { Expose } from "class-transformer";

export class ResponseExerciseDto {
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
	public explanation!: string | null;

	@Expose()
	public distractors?: string[] | null;

	@Expose()
	public collectionId!: string;

	@Expose()
	public createdAt!: Date;

	@Expose()
	public updatedAt!: Date;

	@Expose()
	public isActive!: boolean;

	@Expose()
	public additionalCorrectAnswers?: string[] | null;

	@Expose()
	public correctAnswer!: string | null;

	@Expose()
	public totalAttempts!: number;

	@Expose()
	public correctAttempts!: number;

	@Expose()
	public lastAttemptAt?: Date | null;
}
