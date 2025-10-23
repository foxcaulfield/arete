import { Expose } from "class-transformer";

export class ResponseExerciseDto {
	@Expose()
	public id!: string;

	@Expose()
	public question!: string;

	@Expose()
	public explanation!: string | null;

	@Expose()
	public collectionId!: string;

	@Expose()
	public createdAt!: Date;

	@Expose()
	public updatedAt!: Date;
}

// isActive
// alternativeAnswers
// correctAnswer
// placeholderSequence
// tags
