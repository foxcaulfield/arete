import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import { Collection, Prisma, User, UserRole } from "@prisma/client";
import { BaseService } from "src/base/base.service";
import { PaginatedResponseDto } from "src/common/types";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { ResponseCollectionDto } from "./dto/response-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { UsersService } from "src/users/users.service";
import { PaginationService } from "src/common/pagination.service";
import { CollectionAnalyticsService } from "./collection-analytics.service";
import { CollectionSortBy, FilterCollectionDto, SortOrder } from "./dto/filter-collection.dto";
import { APP_LIMITS_SYMBOL } from "src/configs/app-limits.config";
import type { AppLimitsConfig } from "src/configs/app-limits.config";

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
		private readonly usersService: UsersService,
		private readonly paginationService: PaginationService,
		private readonly collectionAnalyticsService: CollectionAnalyticsService,
		@Inject(APP_LIMITS_SYMBOL) private readonly appLimits: AppLimitsConfig
	) {
		super();
	}

	public async createCollection(dto: CreateCollectionDto, userId: string): Promise<ResponseCollectionDto> {
		// Check collection limit for non-admin users
		const user = await this.prismaService.user.findUnique({ where: { id: userId }, select: { role: true } });
		if (user?.role === UserRole.USER) {
			const collectionCount = await this.prismaService.collection.count({ where: { userId } });
			if (collectionCount >= this.appLimits.USER_MAX_COLLECTIONS) {
				throw new ForbiddenException(
					`You have reached the maximum limit of ${this.appLimits.USER_MAX_COLLECTIONS} collections.`
				);
			}
		}

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
		// const skip = (page - 1) * limit;
		const skip = this.paginationService.calculateSkip(page, limit);
		const [collections, total] = await Promise.all([
			this.prismaService.collection.findMany({ skip, take: limit, include: this.withUser }),
			this.prismaService.collection.count(),
		]);

		return this.paginationService.buildPaginatedResponse(
			this.toResponseDto(ResponseCollectionDto, collections),
			total,
			page,
			limit
		);
	}

	public async getCollectionById(id: string, currentUserId: string): Promise<ResponseCollectionDto> {
		const collection = await this.prismaService.collection.findUnique({
			where: { id },
			include: {
				...this.withUser,
				_count: { select: { exercises: true } },
			},
		});

		if (!collection) {
			throw new NotFoundException("Collection not found");
		}

		const user = await this.usersService.findUser(currentUserId);

		if (!this.canAccessCollection(collection, user)) {
			throw new ForbiddenException("You are not allowed to access this collection.");
		}

		// Enrich with analytics (coverage, attempt counts)
		const enrichedCollections = await this.collectionAnalyticsService.enrichCollectionsForUser(
			[collection],
			currentUserId
		);
		const enriched = enrichedCollections[0] ?? collection;

		return this.toResponseDto(ResponseCollectionDto, enriched);
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
		filter: FilterCollectionDto
	): Promise<PaginatedResponseDto<ResponseCollectionDto>> {
		const {
			page = 1,
			limit = 10,
			search,
			sortBy = CollectionSortBy.UPDATED_AT,
			sortOrder = SortOrder.DESC,
		} = filter;
		const skip = this.paginationService.calculateSkip(page, limit);

		// Build where clause
		const where: Prisma.CollectionWhereInput = {
			userId: targetUserId,
			...(search && {
				OR: [
					{ name: { contains: search, mode: "insensitive" } },
					{ description: { contains: search, mode: "insensitive" } },
				],
			}),
		};

		// Build orderBy
		const orderBy: Prisma.CollectionOrderByWithRelationInput = {
			[sortBy]: sortOrder,
		};

		const [collections, total] = await Promise.all([
			this.prismaService.collection.findMany({
				where,
				skip,
				take: limit,
				orderBy,
				include: {
					...this.withUser,
					_count: { select: { exercises: true } },
				},
			}),
			this.prismaService.collection.count({ where }),
		]);

		const collectionsWithAttempts = await this.collectionAnalyticsService.enrichCollectionsForUser(
			collections,
			targetUserId
		);

		return this.paginationService.buildPaginatedResponse(
			this.toResponseDto(ResponseCollectionDto, collectionsWithAttempts),
			total,
			page,
			limit
		);
	}

	public async countCollections(userId?: string): Promise<number> {
		return this.prismaService.collection.count({
			where: userId ? { userId } : undefined,
		});
	}
}
