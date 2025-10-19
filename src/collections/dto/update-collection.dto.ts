import { IsNotEmpty, MinLength, IsString, IsOptional, MaxLength } from "class-validator";
export class UpdateCollectionDto {
	@IsOptional()
	@IsNotEmpty()
	@MinLength(3)
	@IsString()
	public name?: string;

	@IsOptional()
	@MaxLength(255)
	@IsString()
	public description?: string;
}
