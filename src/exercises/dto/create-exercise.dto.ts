/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Exercise, ExerciseType } from "@prisma/client";
import { IsArray, IsEnum, IsOptional, IsString, Length } from "class-validator";
import { Transform } from "class-transformer";

export function TransformNullableString() {
	const nullableValues = new Set(["null", ""]);
	return Transform(({ value }) => {
		if (typeof value === "string" && nullableValues.has(value.trim())) {
			return null;
		} else if (Array.isArray(value)) {
			value = value.filter((item) => typeof item === "string" && !nullableValues.has(item.trim().toLowerCase()));
		}
		return value;
	});
}

export function TransformToArray() {
	return Transform(({ value }) => {
		if (value === undefined || value === null) {
			return undefined;
		}
		// Empty string means "clear this array"
		if (value === "" || (Array.isArray(value) && value.length === 1 && value[0] === "")) {
			return [];
		}
		return Array.isArray(value) ? value : [value];
	});
}

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
	@TransformToArray()
	@TransformNullableString()
	@IsArray()
	@IsString({ each: true })
	public additionalCorrectAnswers?: string[];

	@IsOptional()
	@TransformToArray()
	@TransformNullableString()
	@IsArray()
	@IsString({ each: true })
	public distractors?: string[];

	@IsOptional()
	@IsString()
	@Length(0, 1000)
	@TransformNullableString()
	public explanation?: string;

	@IsOptional()
	@IsString()
	@Length(0, 1000)
	@TransformNullableString()
	public translation?: string;
}
