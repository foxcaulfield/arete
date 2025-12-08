import { Expose } from "class-transformer";

export class ResponseUserDto {
	@Expose()
	public id!: string;

	@Expose()
	public email!: string;
}
