import { IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ResponseUserDto } from "src/users/dto/response-user.dto";

export class AuthResponseDto {
	@IsString()
	public accessToken!: string;

	@IsString()
	public refreshToken!: string;

	@ValidateNested()
	@Type((): typeof ResponseUserDto => ResponseUserDto)
	public user!: ResponseUserDto;
}
