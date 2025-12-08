import { ExerciseType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export enum ExerciseSortBy {
	QUESTION = "question",
	CREATED_AT = "createdAt",
	UPDATED_AT = "updatedAt",
	TOTAL_ATTEMPTS = "totalAttempts",
}

export enum SortOrder {
	ASC = "asc",
	DESC = "desc",
}

export enum MediaFilter {
	ANY = "any",
	HAS = "has",
	NONE = "none",
}

export class FilterExerciseDto {
	@Type((): typeof Number => Number)
	@Min(1)
	@IsInt()
	@IsOptional()
	public page: number = 1;

	@Type((): typeof Number => Number)
	@Max(100)
	@Min(1)
	@IsInt()
	@IsOptional()
	public limit: number = 10;

	@IsString()
	@IsOptional()
	@Transform(({ value }): string | undefined => (value === "" ? undefined : value))
	public search?: string;

	@IsEnum(ExerciseType)
	@IsOptional()
	@Transform(({ value }): ExerciseType | undefined => (value === "" ? undefined : value))
	public type?: ExerciseType;

	@IsEnum(ExerciseSortBy)
	@IsOptional()
	public sortBy?: ExerciseSortBy = ExerciseSortBy.UPDATED_AT;

	@IsEnum(SortOrder)
	@IsOptional()
	public sortOrder?: SortOrder = SortOrder.DESC;

	@IsEnum(MediaFilter)
	@IsOptional()
	@Transform(({ value }): MediaFilter | undefined => (value === "" || value === "any" ? undefined : value))
	public hasImage?: MediaFilter;

	@IsEnum(MediaFilter)
	@IsOptional()
	@Transform(({ value }): MediaFilter | undefined => (value === "" || value === "any" ? undefined : value))
	public hasAudio?: MediaFilter;
}
