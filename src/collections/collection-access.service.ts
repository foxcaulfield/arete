import { ForbiddenException, Injectable } from "@nestjs/common";
import { Collection, User } from "@prisma/client";
import { UsersService } from "src/users/users.service";
import { CollectionsService } from "./collections.service";
import { CollectionSharingService } from "./collection-sharing.service";

@Injectable()
export class CollectionAccessService {
	public constructor(
		private readonly collectionsService: CollectionsService,
		private readonly usersService: UsersService,
		private readonly collectionSharingService: CollectionSharingService
	) {}

	/** Owner or admin — required for ALL write operations. */
	public async validateCollectionAccess(
		userId: string,
		collectionId: string
	): Promise<{ collection: Collection; currentUser: User }> {
		const [collection, currentUser] = await Promise.all([
			this.collectionsService.findCollection(collectionId),
			this.usersService.findUser(userId),
		]);

		if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
			throw new ForbiddenException("You are not allowed to access this collection");
		}
		return { collection, currentUser };
	}

	/** Owner, admin, or anyone with a share (VIEW / STUDY / EDIT). */
	public async validateCollectionReadAccess(
		userId: string,
		collectionId: string
	): Promise<{ collection: Collection; currentUser: User }> {
		const [collection, currentUser] = await Promise.all([
			this.collectionsService.findCollection(collectionId),
			this.usersService.findUser(userId),
		]);

		if (this.collectionsService.canAccessCollection(collection, currentUser)) {
			return { collection, currentUser };
		}
		const hasShare = await this.collectionSharingService.hasReadAccess(userId, collectionId);
		if (!hasShare) {
			throw new ForbiddenException("You are not allowed to access this collection");
		}
		return { collection, currentUser };
	}

	/** Owner, admin, or anyone with STUDY / EDIT share. */
	public async validateCollectionStudyAccess(
		userId: string,
		collectionId: string
	): Promise<{ collection: Collection; currentUser: User }> {
		const [collection, currentUser] = await Promise.all([
			this.collectionsService.findCollection(collectionId),
			this.usersService.findUser(userId),
		]);

		if (this.collectionsService.canAccessCollection(collection, currentUser)) {
			return { collection, currentUser };
		}
		const canStudy = await this.collectionSharingService.hasStudyAccess(userId, collectionId);
		if (!canStudy) {
			throw new ForbiddenException("You do not have study access to this collection");
		}
		return { collection, currentUser };
	}
}
