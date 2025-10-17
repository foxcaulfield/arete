import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Collection, User, UserRole } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { ResponseCollectionDto } from "./dto/response-collection.dto";
import { plainToInstance } from "class-transformer";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { PaginatedResponseDto, PaginationMetaDto } from "./dto/pagination.dto";

type CollectionWithUser = Collection & { user?: Pick<User, "id" | "name"> };
type OneOrMany<T> = T | T[];

@Injectable()
export class CollectionsService {
	/* Private helpers */
	private withUser = { user: { select: { id: true, name: true } } };
	private notEmptyString = (str: string | undefined): str is string => !!str && str.trim().length > 0;

	private toResponseDto(entity: CollectionWithUser): ResponseCollectionDto;
	private toResponseDto(entity: CollectionWithUser[]): ResponseCollectionDto[];
	private toResponseDto(entity: OneOrMany<CollectionWithUser>): OneOrMany<ResponseCollectionDto> {
		if (Array.isArray(entity)) {
			return entity.map((collection): ResponseCollectionDto => this.convertToResponseDto(collection));
		}
		return this.convertToResponseDto(entity);
	}

	private convertToResponseDto(collection: CollectionWithUser): ResponseCollectionDto {
		return plainToInstance(ResponseCollectionDto, {
			id: collection.id,
			name: collection.name,
			description: collection.description,
			createdAt: collection.createdAt,
			updatedAt: collection.updatedAt,
			user: collection.user ? { id: collection.user.id, name: collection.user.name } : undefined,
		});
	}

	private async getCollection(id: string): Promise<Collection> {
		const collection = await this.prisma.collection.findUnique({
			where: { id },
			include: this.withUser,
		});

		if (!collection) {
			throw new NotFoundException("Collection not found");
		}

		return collection;
	}

	private async getUserOrThrow(userId: string): Promise<User> {
		return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
	}

	private hasCollectionAccess(collection: Collection, user: User): boolean {
		const isOwner = collection.userId === user.id;
		const isAdmin = user.role === UserRole.ADMIN;

		return isOwner || isAdmin;
	}

	private createPaginationMeta(total: number, page: number, limit: number): PaginationMetaDto {
		const totalPages = Math.ceil(total / limit);
		return {
			page,
			limit,
			totalItems: total,
			totalPages,
			hasNextPage: page < totalPages,
			hasPreviousPage: page > 1,
		};
	}

	/* Public methods */
	public constructor(private readonly prisma: PrismaService) {}

	public async createCollection(dto: CreateCollectionDto, userId: string): Promise<ResponseCollectionDto> {
		const duplicate = await this.prisma.collection.findFirst({
			where: {
				userId: userId,
				name: { equals: dto.name.trim(), mode: "insensitive" },
			},
			select: { id: true },
		});
		if (duplicate) {
			throw new ConflictException("User already has a collection with this name.");
		}

		const collection = await this.prisma.collection.create({ data: { ...dto, userId } });
		return this.toResponseDto(collection);
	}

	public async getAllCollections(page = 1, limit = 10): Promise<PaginatedResponseDto<ResponseCollectionDto>> {
		const skip = (page - 1) * limit;
		const [collections, total] = await Promise.all([
			this.prisma.collection.findMany({ skip, take: limit, include: this.withUser }),
			this.prisma.collection.count(),
		]);

		return {
			data: this.toResponseDto(collections),
			pagination: this.createPaginationMeta(total, page, limit),
		};
	}

	public async getCollectionById(id: string, currentUserId: string): Promise<ResponseCollectionDto> {
		const collection = await this.getCollection(id);
		const user = await this.getUserOrThrow(currentUserId);

		if (!this.hasCollectionAccess(collection, user)) {
			throw new ForbiddenException("You are not allowed to access this collection.");
		}

		return this.toResponseDto(collection);
	}

	public async deleteCollection(collectionId: string, currentUserId: string): Promise<ResponseCollectionDto> {
		const collection = await this.getCollection(collectionId);
		const user = await this.getUserOrThrow(currentUserId);

		if (!this.hasCollectionAccess(collection, user)) {
			throw new ForbiddenException("You are not allowed to delete this collection.");
		}

		const deleteResult = await this.prisma.collection.delete({
			where: { id: collectionId },
			include: this.withUser,
		});

		if (!deleteResult) {
			throw new BadRequestException("Failed to delete the collection.");
		}

		return this.toResponseDto(deleteResult);
		// return { success: true };
	}

	public async updateCollection(
		collectionId: string,
		dto: UpdateCollectionDto,
		currentUserId: string
	): Promise<ResponseCollectionDto> {
		// 1) Ensure the collection exists
		const fetchedCollection = await this.getCollection(collectionId);

		// 2) Get fresh current user data, relying on database data
		const currentUser = await this.getUserOrThrow(currentUserId);

		// 3) Authorization: only owner or admin can update
		if (!this.hasCollectionAccess(fetchedCollection, currentUser)) {
			throw new ForbiddenException("You are not allowed to update this collection.");
		}

		// 4) No-op guard: if nothing really changes, return existing
		if (
			(!dto.name || dto.name === fetchedCollection.name) &&
			(!dto.description || dto.description === fetchedCollection.description)
		) {
			return this.toResponseDto(fetchedCollection);
		}

		// 5) Unique-by-author name check (case-insensitive) if name changes
		if (this.notEmptyString(dto.name) && dto.name.trim() !== fetchedCollection.name) {
			const duplicate = await this.prisma.collection.findFirst({
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
		const updated = await this.prisma.collection.update({
			where: { id: collectionId },
			data,
		});
		return this.toResponseDto(updated);
	}

	public async getCollectionsByUserId(
		targetUserId: string,
		page = 1,
		limit = 10
	): Promise<PaginatedResponseDto<ResponseCollectionDto>> {
		const skip = (page - 1) * limit;
		const [collections, total] = await Promise.all([
			this.prisma.collection.findMany({
				where: { userId: targetUserId },
				skip,
				take: limit,
				include: this.withUser,
			}),
			this.prisma.collection.count({ where: { userId: targetUserId } }),
		]);

		return {
			data: this.toResponseDto(collections),
			pagination: this.createPaginationMeta(total, page, limit),
		};
	}

	public async countCollections(userId?: string): Promise<number> {
		return this.prisma.collection.count({
			where: userId ? { userId } : undefined,
		});
	}
}
