import { IsNotEmpty, IsEmail } from "class-validator";
import { Expose } from "class-transformer";

export class ResponseUserDto {
	@Expose()
	@IsNotEmpty()
	public id!: string;

	@Expose()
	@IsEmail()
	public email!: string;
}
