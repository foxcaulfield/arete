import { Controller, Patch, Delete, Post, Get, Body, Param, Query, UseGuards } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { AdminUsersService, type UserListItem } from "./users.service";
import { Roles } from "src/decorators/roles.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { FilterUserDto } from "./dto/filter-user.dto";
import { CollectionSharingService } from "src/collections/collection-sharing.service";
import { PaginatedResponseDto } from "src/common/types";
import { UserRole } from "@prisma/client";
import { RolesGuard } from "src/guards/roles.guard";

type UserAccessResponse = {
	owned: Array<{ id: string; name: string }>;
	shared: Array<{
		collectionId: string;
		name: string;
		ownerId: string;
		ownerName: string | null;
		accessLevel: string;
		grantedAt: Date;
	}>;
};

@Controller("admin/users")
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
	public constructor(
		private readonly service: AdminUsersService,
		private readonly sharingService: CollectionSharingService
	) {}

	@Get()
	public findAll(@Query() filter: FilterUserDto): Promise<PaginatedResponseDto<UserListItem>> {
		return this.service.findAll(filter);
	}

	@Post()
	public async createUser(
		@Body() createData: CreateUserDto
	): Promise<{ success: boolean; user: { id: string; name: string; email: string } }> {
		const user = await this.service.createUser(createData);
		return { success: true, user };
	}

	@Patch(":id")
	public async updateUser(
		@Session() session: UserSession,
		@Param("id") id: string,
		@Body() updateData: UpdateUserDto
	): Promise<{
		success: boolean;
		user: { id: string; name: string; email: string; role: string; isActive: boolean };
	}> {
		const user = await this.service.updateUser(session, id, updateData);
		return { success: true, user };
	}

	@Delete(":id")
	public async deleteUser(
		@Session() session: UserSession,
		@Param("id") id: string
	): Promise<{ success: boolean; message: string }> {
		return await this.service.deleteUser(session, id);
	}

	@Get(":id/access")
	public async getUserAccess(@Param("id") userId: string): Promise<UserAccessResponse> {
		return this.sharingService.listForUser(userId);
	}
}
