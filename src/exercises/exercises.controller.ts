import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UseInterceptors,
	UploadedFiles,
	StreamableFile,
	ParseEnumPipe,
	HttpStatus,
	HttpCode,
} from "@nestjs/common";
import { ExercisesService } from "./exercises.service";
import { CreateExerciseDto } from "./dto/create-exercise.dto";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { ResponseExerciseDto } from "./dto/response-exercise.dto";
import { FilterExerciseDto } from "./dto/filter-exercise.dto";
import { PaginatedResponseDto } from "src/common/types";
import { UpdateExerciseDto } from "./dto/update-exercise.dto";
import { UserAnswerDto, QuizQuestionDto, UserAnswerFeedbackDto, CollectionStatsDto } from "./dto/quiz.dto";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { multerConfig, multerField as field } from "src/configs/multer.config";
import { ExerciseFileType } from "../common/enums/exercise-file-type.enum";
import { QuizService } from "./quiz.service";
import { SrsService } from "src/srs/srs.service";
import { CollectionAccessService } from "src/collections/collection-access.service";
import { UseGuards } from "@nestjs/common";
import { RolesGuard } from "src/guards/roles.guard";

type MulterFiles = Express.Multer.File[];
type UploadedExerciseFiles = { audio?: MulterFiles; image?: MulterFiles };

@Controller("exercises")
@UseGuards(RolesGuard)
export class ExercisesController {
	public constructor(
		private readonly exercisesService: ExercisesService,
		private readonly quizService: QuizService,
		private readonly srsService: SrsService,
		private readonly collectionAccessService: CollectionAccessService
	) {}

	@Post("create")
	@HttpCode(HttpStatus.CREATED)
	@UseInterceptors(FileFieldsInterceptor([field("image"), field("audio")], multerConfig.exerciseFileUpload))
	public async create(
		@UploadedFiles() files: UploadedExerciseFiles,
		@Body() dto: CreateExerciseDto,
		@Session() session: UserSession
	): Promise<ResponseExerciseDto> {
		return this.exercisesService.create(session.user.id, dto, files);
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
	@UseInterceptors(FileFieldsInterceptor([field("image"), field("audio")], multerConfig.exerciseFileUpload))
	public async update(
		@UploadedFiles() files: UploadedExerciseFiles,
		@Param("id") exerciseId: string,
		@Session() session: UserSession,
		@Body() dto: UpdateExerciseDto
	): Promise<ResponseExerciseDto> {
		return this.exercisesService.update(session.user.id, exerciseId, dto, files);
	}

	@Delete("delete/:id")
	public async delete(
		@Param("id") exerciseId: string,
		@Session() session: UserSession
	): Promise<ResponseExerciseDto> {
		return this.exercisesService.delete(session.user.id, exerciseId);
	}

	/* Drill endpoints */

	/* Global drill endpoints — MUST come before :collectionId routes,
	   otherwise Express matches "global" as collectionId */
	@Get("drill/global")
	public async getGlobalDrillExercise(@Session() session: UserSession): Promise<QuizQuestionDto> {
		return this.quizService.getGlobalDrillExercise(session.user.id);
	}

	@Post("drill/global/submit")
	@HttpCode(HttpStatus.OK)
	public async submitGlobalDrillAnswer(
		@Session() session: UserSession,
		@Body() dto: UserAnswerDto
	): Promise<UserAnswerFeedbackDto> {
		return this.quizService.submitGlobalDrillAnswer(session.user.id, dto);
	}

	@Get("drill/:collectionId")
	public async getDrillExercise(
		@Param("collectionId") collectionId: string,
		@Query("mode") mode: string | undefined,
		@Session() session: UserSession
	): Promise<QuizQuestionDto> {
		return this.quizService.getDrillExercise(session.user.id, collectionId, mode ?? "random");
	}

	@Get("drill/:collectionId/stats")
	public async getDrillStats(
		@Param("collectionId") collectionId: string,
		@Session() session: UserSession
	): Promise<CollectionStatsDto> {
		return this.quizService.getCollectionStats(session.user.id, collectionId);
	}

	@Post("drill/:collectionId/submit")
	@HttpCode(HttpStatus.OK)
	public async submitDrillAnswer(
		@Param("collectionId") collectionId: string,
		@Query("mode") mode: string | undefined,
		@Session() session: UserSession,
		@Body() dto: UserAnswerDto
	): Promise<UserAnswerFeedbackDto> {
		return this.quizService.submitDrillAnswer(session.user.id, collectionId, dto, mode ?? "random");
	}

	@Get("due-count")
	public async getDueCount(
		@Query("collectionId") collectionId: string | undefined,
		@Session() session: UserSession
	): Promise<{ count: number }> {
		if (collectionId) {
			await this.collectionAccessService.validateCollectionReadAccess(session.user.id, collectionId);
		}
		const count = await this.srsService.getDueCount(session.user.id, collectionId || undefined);
		return { count };
	}

	@Get("due/:collectionId")
	public async getDueInCollection(
		@Param("collectionId") collectionId: string,
		@Query("limit") limitStr: string | undefined,
		@Query("offset") offsetStr: string | undefined,
		@Session() session: UserSession
	): Promise<{ data: ResponseExerciseDto[]; total: number }> {
		await this.collectionAccessService.validateCollectionReadAccess(session.user.id, collectionId);
		const limit = Math.min(parseInt(limitStr ?? "20", 10) || 20, 100);
		const offset = parseInt(offsetStr ?? "0", 10) || 0;
		const [exercises, total] = await Promise.all([
			this.srsService.getDueExercises(session.user.id, collectionId, limit, offset),
			this.srsService.getDueCount(session.user.id, collectionId),
		]);
		const data = exercises.map(
			(e): ResponseExerciseDto => this.exercisesService.toPublicExerciseDto(e) as ResponseExerciseDto
		);
		return { data, total };
	}

	@Get("files/:type/:filename")
	public getExerciseImageFile(
		@Param("type", new ParseEnumPipe(ExerciseFileType)) fileType: ExerciseFileType,
		@Param("filename") filename: string,
		@Session() session: UserSession
	): Promise<StreamableFile> {
		return this.exercisesService.getExerciseFile(session.user.id, filename, fileType);
	}
}
