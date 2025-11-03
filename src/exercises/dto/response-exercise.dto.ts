import { ExerciseType } from "@prisma/client";
import { Expose } from "class-transformer";

export class ResponseExerciseDto {
	@Expose()
	public id!: string;

	@Expose()
	public question!: string;

	@Expose()
	public audioUrl?: string | null;

	@Expose()
	public imageUrl?: string | null;

	@Expose()
	public type!: ExerciseType;

	@Expose()
	public translation?: string | null;

	@Expose()
	public explanation!: string | null;

	@Expose()
	public distractors?: string[] | null;

	@Expose()
	public collectionId!: string;

	@Expose()
	public createdAt!: Date;

	@Expose()
	public updatedAt!: Date;

	@Expose()
	public isActive!: boolean;

	@Expose()
	public additionalCorrectAnswers?: string[] | null;

	@Expose()
	public correctAnswer!: string | null;
}
// TODO: The following fields ('placeholderSequence', 'tags') are potential future additions to the DTO.
//       They are currently commented out as placeholders. Implement or remove as requirements evolve.
