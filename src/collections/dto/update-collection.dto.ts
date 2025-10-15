import { IsNotEmpty, MinLength, IsString, IsOptional, Max } from "class-validator";
export class UpdateCollectionDto {
	@IsNotEmpty()
	@MinLength(3)
	@IsString()
	public name!: string;

	@IsOptional()
	@Max(255)
	@MinLength(5)
	@IsString()
	public description?: string;
}
