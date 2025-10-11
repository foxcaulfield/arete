import { IsEmail, IsString, IsOptional, IsBoolean, IsArray } from "class-validator";

export class CreateUserDto {
	@IsEmail()
	public email!: string;

	@IsString()
	public password!: string;

	// @IsOptional()
	// @IsEnum(UserRole)
	// public role?: UserRole;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	public permissions?: string[];

	@IsOptional()
	@IsBoolean()
	public isActive?: boolean;

	@IsOptional()
	@IsBoolean()
	public isEmailVerified?: boolean;
}
