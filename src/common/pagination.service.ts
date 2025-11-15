import { Injectable } from "@nestjs/common";
import { PaginatedResponseDto, PaginationMetaDto } from "./types";

@Injectable()
export class PaginationService {
	public calculateSkip(page: number, limit: number): number {
		return (Math.max(page, 1) - 1) * limit;
	}

	// public createPaginationMeta(total: number, page: number, limit: number): PaginationMetaDto {}
	protected createPaginationMeta(total: number, page: number, limit: number): PaginationMetaDto {
		const totalPages = Math.max(1, Math.ceil(total / limit));
		const safePage = Math.min(Math.max(page, 1), totalPages);
		return {
			page: safePage,
			limit,
			totalItems: total,
			totalPages,
			hasPreviousPage: safePage > 1,
			hasNextPage: safePage < totalPages,
		};
	}
	public buildPaginatedResponse<T>(
		data: Array<T>,
		total: number,
		page: number,
		limit: number
	): PaginatedResponseDto<T> {
		return {
			data: data,
			pagination: this.createPaginationMeta(total, page, limit),
		};
	}
}
