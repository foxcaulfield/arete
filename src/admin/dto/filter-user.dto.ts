import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class FilterUserDto {
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
	public limit: number = 20;

	@IsString()
	@IsOptional()
	public search?: string;
}
