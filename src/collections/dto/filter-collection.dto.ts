import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export enum CollectionSortBy {
	NAME = "name",
	CREATED_AT = "createdAt",
	UPDATED_AT = "updatedAt",
}

export enum SortOrder {
	ASC = "asc",
	DESC = "desc",
}

export class FilterCollectionDto {
	@Type((): typeof Number => Number)
	@Min(1)
	@IsInt()
	@IsOptional()
	public page: number = 1;

	@Type((): typeof Number => Number)
	@Max(100)
	@Min(1)
	@IsInt()
	@IsOptional()
	public limit: number = 10;

	@IsString()
	@IsOptional()
	public search?: string;

	@IsEnum(CollectionSortBy)
	@IsOptional()
	public sortBy?: CollectionSortBy = CollectionSortBy.UPDATED_AT;

	@IsEnum(SortOrder)
	@IsOptional()
	public sortOrder?: SortOrder = SortOrder.DESC;
}
