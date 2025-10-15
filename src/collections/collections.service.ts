import { Injectable, NotFoundException } from "@nestjs/common";
import { Collection } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { ResponseCollectionDto } from "./dto/response-collection.dto";
import { plainToInstance } from "class-transformer";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

@Injectable()
export class CollectionsService {
	private toResponseDto(entity: Collection): ResponseCollectionDto;
	private toResponseDto(entity: Collection[]): ResponseCollectionDto[];
	private toResponseDto(entity: Collection | Collection[]): ResponseCollectionDto | ResponseCollectionDto[] {
		if (Array.isArray(entity)) {
			return entity.map((collection): ResponseCollectionDto => this.convertToResponseDto(collection));
		}
		return this.convertToResponseDto(entity);
	}

	private convertToResponseDto(collection: Collection): ResponseCollectionDto {
		return plainToInstance(ResponseCollectionDto, {
			id: collection.id,
			name: collection.name,
			description: collection.description,
			userId: collection.userId,
			createdAt: collection.createdAt,
			updatedAt: collection.updatedAt,
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

	public async getAllCollections(skip = 0, take = 10): Promise<ResponseCollectionDto[]> {
		const collections = await this.prisma.collection.findMany({
			skip,
			take,
		});
		return this.toResponseDto(collections);
	}

	public async getCollectionById(id: string): Promise<ResponseCollectionDto | null> {
		const collection = await this.prisma.collection.findUnique({
			where: { id },
		});
		if (!collection) {
			throw new NotFoundException(`Collection with ID ${id} not found.`);
		}
		return this.toResponseDto(collection);
	}

	public async deleteCollection(id: string): Promise<void> {
		await this.prisma.collection.delete({
			where: { id },
		});
	}

	public async updateCollection(id: string, dto: UpdateCollectionDto): Promise<ResponseCollectionDto | null> {
		const collection = await this.prisma.collection.update({
			where: { id },
			data: dto,
		});
		return this.toResponseDto(collection);
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
		});
		return this.toResponseDto(collections);
	}

	public async countCollections(userId?: string): Promise<number> {
		return this.prisma.collection.count({
			where: userId ? { userId } : undefined,
		});
	}
}
