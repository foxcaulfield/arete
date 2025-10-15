import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateCollectionDto {
	@IsNotEmpty()
	@MinLength(3)
	@IsString()
	public name!: string;

	@IsOptional()
	@MaxLength(255)
	@MinLength(5)
	@IsString()
	public description?: string;

	// @IsNotEmpty()
	// @IsString()
	// public userId!: string;
}
