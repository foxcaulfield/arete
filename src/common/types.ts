export type OneOrMany<T> = T | T[];

export interface PaginationMetaDto {
	page: number;
	limit: number;
	totalItems: number;
	totalPages: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}

export interface PaginatedResponseDto<T> {
	data: T[];
	pagination: PaginationMetaDto;
}

export type NotArray = (object | string | bigint | number | boolean) & { length?: never };
