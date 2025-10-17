export class PaginationMetaDto {
	public page!: number;
	public limit!: number;
	public totalItems!: number;
	public totalPages!: number;
	public hasNextPage!: boolean;
	public hasPreviousPage!: boolean;
}

export class PaginatedResponseDto<T> {
	public data!: T[];
	public pagination!: PaginationMetaDto;
}
