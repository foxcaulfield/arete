import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Collection, User, UserRole } from "@prisma/client";
import { BaseService } from "src/base/base.service";
import { PaginatedResponseDto } from "src/common/types";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { ResponseCollectionDto } from "./dto/response-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { UsersService } from "src/users/users.service";

type CollectionWithUser = Collection & { user?: Pick<User, "id" | "name"> };

@Injectable()
export class CollectionsService extends BaseService {
	/* Private helpers */
	private withUser = { user: { select: { id: true, name: true } } };
	private notEmptyString = (str: string | undefined): str is string => !!str && str.trim().length > 0;

	public async findCollection(id: string): Promise<CollectionWithUser> {
		const collection = await this.prismaService.collection.findUnique({
			where: { id },
			include: this.withUser,
		});

		if (!collection) {
			throw new NotFoundException("Collection not found");
		}

		return collection;
	}

	public canAccessCollection(collection: Collection, user: User): boolean {
		const isOwner = collection.userId === user.id;
		const isAdmin = user.role === UserRole.ADMIN;

		return isOwner || isAdmin;
	}

	/* Public methods */
	public constructor(
		private readonly prismaService: PrismaService,
		private readonly usersService: UsersService
	) {
		super();
	}

	public async createCollection(dto: CreateCollectionDto, userId: string): Promise<ResponseCollectionDto> {
		const duplicate = await this.prismaService.collection.findFirst({
			where: {
				userId: userId,
				name: { equals: dto.name.trim(), mode: "insensitive" },
			},
			select: { id: true },
		});
		if (duplicate) {
			throw new ConflictException("User already has a collection with this name.");
		}

		const collection = await this.prismaService.collection.create({ data: { ...dto, userId } });

		return this.toResponseDto(ResponseCollectionDto, collection);
	}

	public async getAllCollections(page = 1, limit = 10): Promise<PaginatedResponseDto<ResponseCollectionDto>> {
		const skip = (page - 1) * limit;
		const [collections, total] = await Promise.all([
			this.prismaService.collection.findMany({ skip, take: limit, include: this.withUser }),
			this.prismaService.collection.count(),
		]);

		return {
			data: this.toResponseDto(ResponseCollectionDto, collections),
			pagination: this.createPaginationMeta(total, page, limit),
		};
	}

	public async getCollectionById(id: string, currentUserId: string): Promise<ResponseCollectionDto> {
		const collection = await this.findCollection(id);
		const user = await this.usersService.findUser(currentUserId);

		if (!this.canAccessCollection(collection, user)) {
			throw new ForbiddenException("You are not allowed to access this collection.");
		}

		return this.toResponseDto(ResponseCollectionDto, collection);
	}

	public async deleteCollection(collectionId: string, currentUserId: string): Promise<ResponseCollectionDto> {
		const collection = await this.findCollection(collectionId);
		const user = await this.usersService.findUser(currentUserId);

		if (!this.canAccessCollection(collection, user)) {
			throw new ForbiddenException("You are not allowed to delete this collection.");
		}

		const deleteResult = await this.prismaService.collection.delete({
			where: { id: collectionId },
			include: this.withUser,
		});

		if (!deleteResult) {
			throw new BadRequestException("Failed to delete the collection.");
		}

		return this.toResponseDto(ResponseCollectionDto, deleteResult);
		// return { success: true };
	}

	public async updateCollection(
		collectionId: string,
		dto: UpdateCollectionDto,
		currentUserId: string
	): Promise<ResponseCollectionDto> {
		// 1) Ensure the collection exists
		const fetchedCollection = await this.findCollection(collectionId);

		// 2) Get fresh current user data, relying on database data
		const currentUser = await this.usersService.findUser(currentUserId);

		// 3) Authorization: only owner or admin can update
		if (!this.canAccessCollection(fetchedCollection, currentUser)) {
			throw new ForbiddenException("You are not allowed to update this collection.");
		}

		// 4) No-op guard: if nothing really changes, return existing
		if (
			(!dto.name || dto.name === fetchedCollection.name) &&
			(!dto.description || dto.description === fetchedCollection.description)
		) {
			return this.toResponseDto(ResponseCollectionDto, fetchedCollection);
		}

		// 5) Unique-by-author name check (case-insensitive) if name changes
		if (this.notEmptyString(dto.name) && dto.name.trim() !== fetchedCollection.name) {
			const duplicate = await this.prismaService.collection.findFirst({
				where: {
					userId: fetchedCollection.userId,
					id: { not: collectionId },
					name: { equals: dto.name.trim(), mode: "insensitive" },
				},
				select: { id: true },
			});
			if (duplicate) {
				throw new ConflictException("User already has a collection with this name.");
			}
		}

		// 6) Build a safe update payload (allowlist fields)
		const data: { name?: string; description?: string } = {};
		if (this.notEmptyString(dto.name)) data.name = dto.name.trim();
		if (this.notEmptyString(dto.description)) data.description = dto.description;

		if (Object.keys(data).length === 0) {
			throw new BadRequestException("No valid fields provided to update.");
		}

		// 7) Update and return DTO
		const updated = await this.prismaService.collection.update({
			where: { id: collectionId },
			data,
		});
		return this.toResponseDto(ResponseCollectionDto, updated);
	}

	public async getCollectionsByUserId(
		targetUserId: string,
		page = 1,
		limit = 10
	): Promise<PaginatedResponseDto<ResponseCollectionDto>> {
		const skip = (page - 1) * limit;
		const [collections, total] = await Promise.all([
			this.prismaService.collection.findMany({
				where: { userId: targetUserId },
				skip,
				take: limit,
				include: {
					...this.withUser,
					_count: {
						select: {
							exercises: true,
						},
					},
				},
			}),
			this.prismaService.collection.count({ where: { userId: targetUserId } }),
		]);

		const toIds = (e: { id: string }): string => e.id;

		const collectionIds = collections.map(toIds);

		const exercises = await this.prismaService.exercise.findMany({
			where: { collectionId: { in: collectionIds } },
			select: { id: true, collectionId: true },
		});

		const exerciseIds = exercises.map(toIds);
		const exerciseToCollectionMap = new Map(exercises.map((e): [string, string] => [e.id, e.collectionId]));

		const attemptCounts = await this.prismaService.attempt.groupBy({
			by: ["exerciseId"],
			where: {
				userId: targetUserId,
				exerciseId: { in: exerciseIds },
			},
			_count: {
				id: true,
			},
		});

		// Aggregate attempts by collection
		const collectionAttemptMap = new Map<string, number>();
		for (const { exerciseId, _count } of attemptCounts) {
			const collectionId = exerciseToCollectionMap.get(exerciseId);
			if (collectionId) {
				const current = collectionAttemptMap.get(collectionId) || 0;
				collectionAttemptMap.set(collectionId, current + _count.id);
			}
		}

		// Enrich collections with attempt counts
		const collectionsWithAttempts = collections.map(
			(
				collection
			): Collection & {
				attemptCount: number;
				exerciseCount: number;
			} => ({
				...collection,
				attemptCount: collectionAttemptMap.get(collection.id) || 0,
				exerciseCount: collection?._count?.exercises || 0,
			})
		);

		console.log("COLLECTIONS WITH ATTEMPTS:", collectionsWithAttempts);

		return {
			data: this.toResponseDto(ResponseCollectionDto, collectionsWithAttempts),
			pagination: this.createPaginationMeta(total, page, limit),
		};
	}

	public async countCollections(userId?: string): Promise<number> {
		return this.prismaService.collection.count({
			where: userId ? { userId } : undefined,
		});
	}
}
