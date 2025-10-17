import { Body, Controller, Delete, Get, Param, ParseIntPipe as AsInt, Patch, Post, Query } from "@nestjs/common";
import { CollectionsService } from "./collections.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { ResponseCollectionDto } from "./dto/response-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { PaginatedResponseDto } from "./dto/pagination.dto";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { Roles } from "src/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

type CreateDto = CreateCollectionDto;
type UpdateDto = UpdateCollectionDto;
type ResponseDto = ResponseCollectionDto;
type Paginated<T> = PaginatedResponseDto<T>;

@Controller("collections")
export class CollectionsController {
	public constructor(private readonly service: CollectionsService) {}

	// @Roles(UserRole.ADMIN)
	@Post("create")
	public create(@Body() dto: CreateDto, @Session() session: UserSession): Promise<ResponseDto> {
		return this.service.createCollection(dto, session.user.id);
	}

	@Get("list")
	public getAll(
		@Query("page", AsInt) page: number = 5,
		@Query("limit", AsInt) limit: number = 5,
		@Session() session: UserSession
	): Promise<Paginated<ResponseDto>> {
		return this.service.getCollectionsByUserId(session.user.id, page, limit);
	}

	@Get("get_by_id/:id")
	public getById(@Param("id") id: string, @Session() session: UserSession): Promise<ResponseDto> {
		return this.service.getCollectionById(id, session.user.id);
	}

	@Roles(UserRole.ADMIN)
	@Get("all")
	public getAllCollections(
		@Query("page", AsInt) page: number = 1,
		@Query("limit", AsInt) limit: number = 5
	): Promise<Paginated<ResponseDto>> {
		return this.service.getAllCollections(page, limit);
	}

	@Patch("update/:id")
	public update(
		@Param("id") id: string,
		@Body() dto: UpdateDto,
		@Session() session: UserSession
	): Promise<ResponseDto | null> {
		return this.service.updateCollection(id, dto, session.user.id);
	}

	@Delete("delete/:id")
	public async delete(@Param("id") collectionId: string, @Session() session: UserSession): Promise<ResponseDto> {
		return await this.service.deleteCollection(collectionId, session.user.id);
	}
}
