import { IsString, MinLength } from "class-validator";

export class RefreshTokenDto {
	@IsString()
	@MinLength(10)
	public refreshToken!: string;
}
