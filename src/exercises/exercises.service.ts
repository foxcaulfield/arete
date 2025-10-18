import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { UpdateExerciseDto } from "./dto/update-exercise.dto";
import { CreateExerciseDto } from "./dto/create-exercise.dto";
import { ResponseExerciseDto } from "./dto/response-exercise.dto";
import { FilterExerciseDto } from "./dto/filter-exercise.dto";
import { BaseService } from "src/base/base.service";
import { CollectionsService } from "src/collections/collections.service";
import { UsersService } from "src/users/users.service";
import { PaginatedResponseDto } from "src/common/types";

@Injectable()
export class ExercisesService extends BaseService {
	/* Private helpers */

	private async getExercise(id: string): Promise<ResponseExerciseDto> {
		const exercise = await this.prismaService.exercise.findFirst({
			where: { id },
			// include
		});

		if (!exercise) {
			throw new NotFoundException("Exercise not found");
		}

		return this.toResponseDto(ResponseExerciseDto, exercise);
	}

	public constructor(
		private readonly prismaService: PrismaService,
		private readonly usersService: UsersService,
		private readonly collectionsService: CollectionsService
	) {
		super();
	}

	public async create(currentUserId: string, dto: CreateExerciseDto): Promise<ResponseExerciseDto> {
		const collection = await this.collectionsService.findCollection(dto.collectionId);
		const currentUser = await this.usersService.findUser(currentUserId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("You are not allowed to update this collection.");
		}

		const exercise = await this.prismaService.exercise.create({
			data: {
				question: dto.question,
				explanation: dto.explanation,
				correctAnswer: dto.correctAnswer,
				alternativeAnswers: dto.alternativeAnswers,
				collectionId: dto.collectionId,
				tags: dto.tags,
			},
		});

		return this.toResponseDto(ResponseExerciseDto, exercise);
	}

	public async getByCollection(
		currentUserId: string,
		collectionId: string,
		filter: FilterExerciseDto
	): Promise<PaginatedResponseDto<ResponseExerciseDto>> {
		const collection = await this.collectionsService.findCollection(collectionId);
		const currentUser = await this.usersService.findUser(currentUserId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("You are not allowed to update this collection.");
		}

		const [exercises, total] = await Promise.all([
			this.prismaService.exercise.findMany({
				where: {
					collectionId: collectionId,
				},
				skip: filter.offset,
				take: filter.limit,
				orderBy: { createdAt: "desc" },
			}),
			this.prismaService.exercise.count({ where: { collectionId } }),
		]);

		return {
			data: this.toResponseDto(ResponseExerciseDto, exercises),
			pagination: this.createPaginationMeta(total, 0, filter.limit),
		};
	}

	public async findOne(currentUserId: string, exerciseId: string): Promise<ResponseExerciseDto> {
		const exercise = await this.getExercise(exerciseId);
		const currentUser = await this.usersService.findUser(currentUserId);
		const collection = await this.collectionsService.findCollection(exercise.collectionId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("Forbidden");
		}

		return this.toResponseDto(ResponseExerciseDto, exercise);
	}

	public async update(
		currentUserId: string,
		exerciseId: string,
		dto: UpdateExerciseDto
	): Promise<ResponseExerciseDto> {
		const exercise = await this.getExercise(exerciseId);
		const currentUser = await this.usersService.findUser(currentUserId);
		const collection = await this.collectionsService.findCollection(exercise.collectionId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("Forbidden");
		}

		// No-op guard TODO
		// Build a safe exercise payload
		// Update and return DTO

		const updated = await this.prismaService.exercise.update({
			where: {
				id: exerciseId,
			},
			data: dto,
		});

		return this.toResponseDto(ResponseExerciseDto, updated);
	}

	public async delete(currentUserId: string, exerciseId: string): Promise<ResponseExerciseDto> {
		const exercise = await this.getExercise(exerciseId);
		const currentUser = await this.usersService.findUser(currentUserId);
		const collection = await this.collectionsService.findCollection(exercise.collectionId);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("Forbidden");
		}
		// Delete
		// Check if delete success
		// Return result

		const deleted = await this.prismaService.exercise.delete({
			where: {
				id: exerciseId,
			},
		});

		return this.toResponseDto(ResponseExerciseDto, deleted);
	}
}
