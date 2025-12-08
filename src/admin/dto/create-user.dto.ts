import { IsEmail, IsNotEmpty, IsOptional, IsEnum } from "class-validator";
import { UserRole } from "@prisma/client";

export class CreateUserDto {
	@IsNotEmpty()
	public name!: string;

	@IsEmail()
	public email!: string;

	@IsNotEmpty()
	public password!: string;

	@IsOptional()
	@IsEnum(UserRole)
	public role?: UserRole;
}
