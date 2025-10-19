import { Expose } from "class-transformer";

export class ResponseExerciseDto {
	@Expose()
	public id!: string;

	@Expose()
	public title!: string;

	@Expose()
	public description!: string | null;

	@Expose()
	public collectionId!: string;

	@Expose()
	public createdAt!: Date;

	@Expose()
	public updatedAt!: Date;
}
