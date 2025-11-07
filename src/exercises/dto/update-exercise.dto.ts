import { PartialType } from "@nestjs/mapped-types";
import { CreateExerciseDto } from "./create-exercise.dto";
import { IsOptional } from "class-validator";
import { Transform } from "class-transformer";

export class UpdateExerciseDto extends PartialType(CreateExerciseDto) {
	@IsOptional()
	@Transform(({ value }): boolean => value === "on" || value === true)
	public setNullAudio?: boolean;

	@IsOptional()
	@Transform(({ value }): boolean => value === "on" || value === true)
	public setNullImage?: boolean;
}
