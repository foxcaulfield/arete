import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { CollectionsService } from "./collections.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { ResponseCollectionDto } from "./dto/response-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { Roles } from "src/decorators/roles.decorator";
import { UserRole } from "@prisma/client";

@Controller("collections")
export class CollectionsController {
	public constructor(private readonly collectionsService: CollectionsService) {}

	@Post("create")
	public create(@Body() dto: CreateCollectionDto, @Session() session: UserSession): Promise<ResponseCollectionDto> {
		return this.collectionsService.createCollection(dto, session.user.id);
	}

	@Get("list")
	public getAll(@Session() session: UserSession): Promise<ResponseCollectionDto[]> {
		return this.collectionsService.getCollectionsByUserId(session.user.id);
	}

	@Get("get_by_id/:id")
	public getById(
		@Param("id") id: string,
		@Session() currentUserSession: UserSession
	): Promise<ResponseCollectionDto> {
		return this.collectionsService.getCollectionById(id, currentUserSession.user.id);
	}

	@Roles(UserRole.ADMIN)
	@Get("all")
	public getAllCollections(): Promise<ResponseCollectionDto[]> {
		return this.collectionsService.getAllCollections();
	}

	@Patch("update/:id")
	public update(@Param("id") id: string, @Body() dto: UpdateCollectionDto): Promise<ResponseCollectionDto | null> {
		return this.collectionsService.updateCollection(id, dto);
	}

	@Delete("delete/:id")
	public delete(@Param("id") id: string): Promise<void> {
		return this.collectionsService.deleteCollection(id);
	}
}
