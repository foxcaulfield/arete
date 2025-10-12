import { IsString } from "class-validator";

export class TokensResponseDto {
	@IsString()
	public accessToken!: string;

	@IsString()
	public refreshToken!: string;
}
