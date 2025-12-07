import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

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
}
