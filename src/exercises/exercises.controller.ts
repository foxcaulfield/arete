import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ExercisesService } from "./exercises.service";
import { CreateExerciseDto } from "./dto/create-exercise.dto";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { ResponseExerciseDto } from "./dto/response-exercise.dto";
import { FilterExerciseDto } from "./dto/filter-exercise.dto";
import { PaginatedResponseDto } from "src/common/types";
import { UpdateExerciseDto } from "./dto/update-exercise.dto";
import { DrillIncomingAnswerDto, ResponseDrillQuestionDto, ResponseDrillResultDto } from "./dto/quiz.dto";

@Controller("exercises")
export class ExercisesController {
	public constructor(private readonly exercisesService: ExercisesService) {}

	@Post("create")
	public async create(@Body() dto: CreateExerciseDto, @Session() session: UserSession): Promise<ResponseExerciseDto> {
		return this.exercisesService.create(session.user.id, dto);
	}

	@Get("by_collection/:collectionId")
	public async getExercisesForCollection(
		@Param("collectionId") collectionId: string,
		@Session() session: UserSession,
		@Query() filter: FilterExerciseDto
	): Promise<PaginatedResponseDto<ResponseExerciseDto>> {
		return this.exercisesService.getExercisesInCollection(session.user.id, collectionId, filter);
	}

	@Get("get_by_id/:id")
	public async getExerciseById(
		@Param("id") exerciseId: string,
		@Session() session: UserSession
	): Promise<ResponseExerciseDto> {
		return this.exercisesService.getExerciseById(session.user.id, exerciseId);
	}

	@Patch("update/:id")
	public async update(
		@Param("id") exerciseId: string,
		@Session() session: UserSession,
		@Body() dto: UpdateExerciseDto
	): Promise<ResponseExerciseDto> {
		return this.exercisesService.update(session.user.id, exerciseId, dto);
	}

	@Delete("delete/:id")
	public async delete(
		@Param("id") exerciseId: string,
		@Session() session: UserSession
	): Promise<ResponseExerciseDto> {
		return this.exercisesService.delete(session.user.id, exerciseId);
	}

	/* Drill endpoints */
	@Get("drill/:collectionId")
	public async getDrillExercise(
		@Param("collectionId") collectionId: string,
		@Session() session: UserSession
	): Promise<ResponseDrillQuestionDto> {
		return this.exercisesService.getDrillExercise(session.user.id, collectionId);
	}

	@Post("drill/:collectionId/submit")
	public async submitDrillAnswer(
		@Param("collectionId") collectionId: string,
		@Session() session: UserSession,
		@Body() dto: DrillIncomingAnswerDto
	): Promise<ResponseDrillResultDto> {
		return this.exercisesService.submitDrillAnswer(session.user.id, collectionId, dto);
	}
}
