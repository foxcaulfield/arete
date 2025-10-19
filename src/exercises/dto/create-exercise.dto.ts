import { Exercise } from "@prisma/client";
import { IsArray, IsOptional, IsString, Length } from "class-validator";

export class CreateExerciseDto implements Partial<Exercise> {
	// public placeholderSequence?: string | null | undefined;
	@IsString()
	@Length(5, 500)
	public question!: string;

	@IsString()
	@Length(1, 50)
	public correctAnswer!: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public alternativeAnswers?: string[];

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public tags?: string[];

	@IsOptional()
	@IsString()
	@Length(0, 1000)
	public explanation?: string;

	@IsString()
	public collectionId!: string;
}
