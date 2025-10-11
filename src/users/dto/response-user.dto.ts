import { UserRole } from "@prisma/client";
import { IsNotEmpty, IsEmail, IsEnum, IsBoolean, IsArray, IsString, IsNumber } from "class-validator";
import { Expose } from "class-transformer";

export class ResponseUserDto {
	@Expose()
	@IsNotEmpty()
	public id!: string;

	@Expose()
	@IsEmail()
	public email!: string;

	@Expose()
	@IsEnum(UserRole)
	public readonly role!: UserRole;

	@Expose()
	@IsBoolean()
	public isActive!: boolean;

	@Expose()
	@IsArray()
	@IsString({ each: true })
	public permissions!: string[];

	@Expose()
	@IsNumber()
	public tokenVersion!: number;
}
