import { Expose, Type } from "class-transformer";

class ResponseUserDto {
	@Expose()
	public id!: string;

	@Expose()
	public email!: string;

	@Expose()
	public name?: string | null;
}

export class ResponseCollectionDto {
	@Expose()
	public id!: string;

	@Expose()
	public name!: string;

	@Expose()
	public description?: string;

	@Expose()
	public createdAt!: Date;

	@Expose()
	public updatedAt!: Date;

	@Expose()
	@Type((): typeof ResponseUserDto => ResponseUserDto)
	public user?: ResponseUserDto;
}
