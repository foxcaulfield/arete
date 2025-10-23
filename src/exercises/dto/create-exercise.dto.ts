import { Exercise, ExerciseType } from "@prisma/client";
import { IsArray, IsEnum, IsOptional, IsString, Length } from "class-validator";

export class CreateExerciseDto implements Partial<Exercise> {
	@IsString()
	public collectionId!: string;

	@IsEnum(ExerciseType)
	public type!: ExerciseType;

	@IsString()
	@Length(5, 500)
	public question!: string;

	@IsString()
	@Length(1, 50)
	public correctAnswer!: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public additionalCorrectAnswers?: string[];

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public distractors?: string[];

	// @IsOptional()
	// @IsArray()
	// @IsString({ each: true })
	// public tags?: string[];

	@IsOptional()
	@IsString()
	@Length(0, 1000)
	public explanation?: string;
}
