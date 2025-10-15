import { Expose } from "class-transformer";

export class ResponseCollectionDto {
	@Expose()
	public id!: string;

	@Expose()
	public name!: string;

	@Expose()
	public description?: string;

	@Expose()
	public userId!: string;

	@Expose()
	public createdAt!: Date;

	@Expose()
	public updatedAt!: Date;
}
