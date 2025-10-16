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

type CollectionWithUser = Collection & { user?: Pick<User, "id" | "name"> };

@Injectable()
export class CollectionsService {
	private toResponseDto(entity: CollectionWithUser): ResponseCollectionDto;
	private toResponseDto(entity: CollectionWithUser[]): ResponseCollectionDto[];
	private toResponseDto(
		entity: CollectionWithUser | CollectionWithUser[]
	): ResponseCollectionDto | ResponseCollectionDto[] {
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

	public constructor(private readonly prisma: PrismaService) {}

	public async createCollection(dto: CreateCollectionDto, userId: string): Promise<ResponseCollectionDto> {
		const collection = await this.prisma.collection.create({
			data: {
				...dto,
				userId,
			},
		});

		return this.toResponseDto(collection);
	}

	public async getAllCollections(skip = 0, take = 100): Promise<ResponseCollectionDto[]> {
		const collections = await this.prisma.collection.findMany({
			skip,
			take,
			include: {
				user: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});
		return this.toResponseDto(collections);
	}

	public async getCollectionById(id: string, currentUserId: string): Promise<ResponseCollectionDto> {
		const collection = await this.prisma.collection.findUnique({
			where: { id },
			select: {
				id: true,
				name: true,
				description: true,
				userId: true,
				createdAt: true,
				updatedAt: true,
				user: { select: { id: true, name: true } },
			},
		});

		if (!collection) {
			throw new NotFoundException(`Collection with ID ${id} not found.`);
		}

		const user = await this.prisma.user.findUnique({ where: { id: currentUserId } });

		const isOwner = collection.userId === currentUserId;
		const isAdmin = user?.role === UserRole.ADMIN;

		if (!isOwner && !isAdmin) {
			throw new ForbiddenException("You are not allowed to access this collection.");
		}

		return this.toResponseDto(collection);
	}

	public async deleteCollection(id: string): Promise<void> {
		await this.prisma.collection.delete({
			where: { id },
		});
	}

	public async updateCollection(
		id: string,
		dto: UpdateCollectionDto,
		currentUserId: string
	): Promise<ResponseCollectionDto> {
		// 1) Ensure the collection exists
		const currentCollection = await this.prisma.collection.findUnique({ where: { id } });
		if (!currentCollection) {
			throw new NotFoundException(`Collection with ID ${id} not found.`);
		}

		// 2) Always use fresh user data from DB (do not rely on session)
		const currentUser = await this.prisma.user.findUnique({
			where: { id: currentUserId },
			select: { id: true, role: true },
		});

		if (!currentUser) {
			throw new NotFoundException(`User with ID ${currentUserId} not found.`);
		}

		// 3) Authorization: only owner or admin can update
		const collectionOwner = await this.prisma.user.findUnique({ where: { id: currentCollection.userId } });
		if (!collectionOwner) {
			throw new NotFoundException(`Owner user with ID ${currentCollection.userId} not found.`);
		}

		const isOwner = currentUser.id === currentCollection.userId;
		const isAdmin = currentUser.role === UserRole.ADMIN;

		// Alternative checks if needed:
		// const isOwner = existing.userId === collectionOwner.id;

		if (!isOwner && !isAdmin) {
			throw new ForbiddenException("You are not allowed to update this collection.");
		}

		// 4) No-op guard: if nothing really changes, return existing
		if (
			(dto.name === undefined || dto.name === currentCollection.name) &&
			(dto.description === undefined || dto.description === currentCollection.description)
		) {
			return this.toResponseDto(currentCollection);
		}

		// 5) Unique-by-author name check (case-insensitive) if name changes
		if (dto.name && dto.name.trim().length > 0 && dto.name.trim() !== currentCollection.name) {
			const duplicate = await this.prisma.collection.findFirst({
				where: {
					// userId: currentCollection.userId,
					userId: collectionOwner.id,
					id: { not: id },
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
		if (dto.name !== undefined) data.name = dto.name.trim();
		if (dto.description !== undefined) data.description = dto.description;

		if (Object.keys(data).length === 0) {
			throw new BadRequestException("No valid fields provided to update.");
		}

		// 7) Update and return DTO
		const updated = await this.prisma.collection.update({
			where: { id },
			data,
		});
		return this.toResponseDto(updated);
	}

	public async getCollectionsByUserId(
		targetUserId: string
		// requestingUserId: string
	): Promise<ResponseCollectionDto[]> {
		// if (targetUserId !== requestingUserId) {
		// 	throw new ForbiddenException("You are not allowed to access collections of other users.");
		// }
		const collections = await this.prisma.collection.findMany({
			where: { userId: targetUserId },
			include: {
				user: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});
		return this.toResponseDto(collections);
	}

	public async countCollections(userId?: string): Promise<number> {
		return this.prisma.collection.count({
			where: userId ? { userId } : undefined,
		});
	}
}
