import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class FilterExerciseDto {
	@Type((): typeof Number => Number)
	@Min(0)
	@IsInt()
	@IsOptional()
	public offset: number = 0;

	@Type((): typeof Number => Number)
	@Max(100)
	@Min(1)
	@IsInt()
	@IsOptional()
	public limit: number = 20;
}
