// import { Optional } from "@nestjs/common";
import { Expose } from "class-transformer";
import { IsNotEmpty, IsString } from "class-validator";

export class ResponseDrillQuestionDto {
	@Expose()
	public exerciseId!: string;

	@Expose()
	public question!: string;

	// @Expose()
	// public placehoderSequence!: string;

	// @Optional()
	// @Expose()
	// public tags?: string[];
}

export class DrillIncomingAnswerDto {
	@IsString()
	@IsNotEmpty()
	public exerciseId!: string;

	@IsString()
	@IsNotEmpty()
	public userAnswer!: string;
}

export class ResponseDrillResultDto {
	@Expose()
	public isCorrect!: boolean;

	@Expose()
	public correctAnswer!: string;

	@Expose()
	public explanation?: string;

	@Expose()
	public nextExerciseId!: string;
}
