import { IsEmail, IsString, MinLength } from "class-validator";

export class RegisterDto {
	@IsEmail()
	public email!: string;

	@IsString()
	@MinLength(8)
	public password!: string;

	// @IsOptional()
	// @IsBoolean()
	// public isActive?: boolean;

	// @IsOptional()
	// @IsBoolean()
	// public isEmailVerified?: boolean;
}
