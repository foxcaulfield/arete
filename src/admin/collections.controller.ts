import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { Roles } from "src/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { CollectionSharingService, type ShareDto } from "src/collections/collection-sharing.service";
import { GrantCollectionAccessDto } from "./dto/grant-collection-access.dto";
import { RolesGuard } from "src/guards/roles.guard";

@Controller("admin/collections")
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminCollectionsController {
	public constructor(private readonly sharingService: CollectionSharingService) {}

	@Get(":id/access")
	public listAccess(@Param("id") collectionId: string): Promise<{
		collection: { id: string; name: string };
		owner: { id: string; name: string | null; email: string };
		grants: ShareDto[];
	}> {
		return this.sharingService.listForCollection(collectionId);
	}

	@Post(":id/access")
	public grant(
		@Session() session: UserSession,
		@Param("id") collectionId: string,
		@Body() dto: GrantCollectionAccessDto
	): Promise<ShareDto> {
		return this.sharingService.grant(session.user.id, collectionId, dto.userId, dto.accessLevel ?? undefined);
	}

	@Delete(":id/access/:userId")
	public revoke(@Param("id") collectionId: string, @Param("userId") userId: string): Promise<{ success: true }> {
		return this.sharingService.revoke(collectionId, userId);
	}
}
