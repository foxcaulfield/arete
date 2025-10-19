import { ClassConstructor, plainToInstance } from "class-transformer";
import { NotArray, OneOrMany, PaginationMetaDto } from "src/common/types";

export abstract class BaseService {
	protected createPaginationMeta(total: number, page: number, limit: number): PaginationMetaDto {
		const totalPages = Math.ceil(total / limit);
		return {
			page,
			limit,
			totalItems: total,
			totalPages,
			hasPreviousPage: page > 1,
			hasNextPage: page < totalPages,
		};
	}
	protected toResponseDto<T, V extends NotArray>(DtoClass: ClassConstructor<T>, entity: V): T;
	protected toResponseDto<T, V extends NotArray>(DtoClass: ClassConstructor<T>, entity: Array<V>): T[];
	protected toResponseDto<T, V extends NotArray>(DtoClass: ClassConstructor<T>, entity: OneOrMany<V>): OneOrMany<T> {
		if (Array.isArray(entity)) {
			return entity.map((item): T => plainToInstance(DtoClass, item));
		}
		return plainToInstance(DtoClass, entity);
	}
}

// ********* IGNORE BELOW THIS LINE ********

// protected toResponseDto<T>(DtoClass: ClassConstructor<T>, entity: T): T;
// protected toResponseDto<T extends Array<unknown>>(DtoClass: ClassConstructor<T>, entity: T[]): T[];
// protected toResponseDto<T>(DtoClass: ClassConstructor<T>, entity: OneOrMany<T>): OneOrMany<T> {
// 	if (Array.isArray(entity)) {
// 		return entity.map((item): T => plainToInstance(DtoClass, item));
// 	}
// 	return plainToInstance(DtoClass, entity);
// }

// Generic DTO mapper. Gets entity or array of entities and maps to specified DTO class.
// import { plainToInstance } from "class-transformer";
// export function toDto<T, V>(dtoClass: new () => T, entity: V): T;
// export function toDto<T, V>(dtoClass: new () => T, entity: V[]): T[];
// export function toDto<T, V>(dtoClass: new () => T, entity: V | V[]): T | T[] {
// 	if (Array.isArray(entity)) {
// 		return entity.map((item): T => plainToInstance(dtoClass, item));
// 	}
// 	return plainToInstance(dtoClass, entity);
// }

// import { ClassConstructor, plainToInstance } from "class-transformer";

// export function toDto<T>(DtoClass: ClassConstructor<T>, entity: any | any[]): T | T[] {
// 	if (Array.isArray(entity)) {
// 		return entity.map((item): T => plainToInstance(DtoClass, item));
// 	}
// 	return plainToInstance(DtoClass, entity);
// }

// class PaginatedResponseDto<T> {
// 	public data!: T[];
// 	public pagination!: PaginationMetaDto;
// }
// if (Array.isArray(entity)) {
// 	return entity.map((item): ResponseCollectionDto => this.convertToResponseDto(item));
// }
// return this.convertToResponseDto(entity);
// protected toDto<T>(DtoClass: ClassConstructor<T>, entity: any | any[]): T | T[] {
// 	if (Array.isArray(entity)) {
// 		return entity.map((item): T => plainToInstance(DtoClass, item));
// 	}
// 	return plainToInstance(DtoClass, entity);
// }

// private convertToResponseDto(collection: CollectionWithUser): ResponseCollectionDto {
// 	return plainToInstance(ResponseCollectionDto, {
// 		id: collection.id,
// 		name: collection.name,
// 		description: collection.description,
// 		createdAt: collection.createdAt,
// 		updatedAt: collection.updatedAt,
// 		user: collection.user ? { id: collection.user.id, name: collection.user.name } : undefined,
// 	});
// }
// private toResponseDto(entity: CollectionWithUser): ResponseCollectionDto;
// private toResponseDto(entity: CollectionWithUser[]): ResponseCollectionDto[];
// private toResponseDto(entity: OneOrMany<CollectionWithUser>): OneOrMany<ResponseCollectionDto> {
// 	if (Array.isArray(entity)) {
// 		return entity.map((collection): ResponseCollectionDto => this.convertToResponseDto(collection));
// 	}
// 	return this.convertToResponseDto(entity);
// }

// private convertToResponseDto(collection: CollectionWithUser): ResponseCollectionDto {
// 	return plainToInstance(ResponseCollectionDto, {
// 		id: collection.id,
// 		name: collection.name,
// 		description: collection.description,
// 		createdAt: collection.createdAt,
// 		updatedAt: collection.updatedAt,
// 		user: collection.user ? { id: collection.user.id, name: collection.user.name } : undefined,
// 	});
// }
