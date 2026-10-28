import { ForbiddenException, Injectable } from "@nestjs/common";
// import { Collection, CollectionAccessLevel, User, UserRole } from "@prisma/client";
import { Collection, CollectionAccessLevel, User, UserRole } from "@prisma/client";
import type { MyAccessLevel } from "./dto/response-collection.dto";
import { UsersService } from "src/users/users.service";
import { CollectionsService } from "./collections.service";
import { CollectionSharingService } from "./collection-sharing.service";
// import { MyAccessLevel } from "./dto/response-collection.dto";

@Injectable()
export class CollectionAccessService {
	public constructor(
		private readonly collectionsService: CollectionsService,
		private readonly usersService: UsersService,
		private readonly collectionSharingService: CollectionSharingService
	) {}

	/**
	 * Resolves the caller's effective access level for a collection.
	 * Returns null if the caller has no access at all (should have been
	 * rejected by a validate* method first — null is a safety net).
	 *
	 * Used by collection and exercise DTO mappers to populate `myAccessLevel`.
	 */
	public async resolveAccessLevel(
		userId: string,
		collection: Collection,
		currentUser: User
	): Promise<MyAccessLevel | null> {
		if (this.collectionsService.canAccessCollection(collection, currentUser)) {
			return currentUser.role === UserRole.ADMIN && collection.userId !== currentUser.id ? "ADMIN" : "OWNER";
		}
		const share = await this.collectionSharingService.getShare(userId, collection.id);
		if (!share) return null;
		return share.accessLevel === CollectionAccessLevel.EDIT
			? "EDIT"
			: share.accessLevel === CollectionAccessLevel.STUDY
				? "STUDY"
				: "VIEW";
	}

	// /**
	//  * Owner or admin only.
	//  * Use for operations on the collection itself — rename, delete.
	//  * Not for exercise CRUD (see validateExerciseWriteAccess).
	//  */
	// public async validateCollectionManageAccess(
	// 	userId: string,
	// 	collectionId: string
	// ): Promise<{ collection: Collection; currentUser: User }> {
	// 	const [collection, currentUser] = await Promise.all([
	// 		this.collectionsService.findCollection(collectionId),
	// 		this.usersService.findUser(userId),
	// 	]);

	// 	if (!this.collectionsService.canAccessCollection(collection, currentUser)) {
	// 		throw new ForbiddenException("You are not allowed to manage this collection");
	// 	}
	// 	return { collection, currentUser };
	// }

	/**
	 * Owner, admin, or EDIT-share holder.
	 * Use for exercise create/update/delete — modifying the collection's
	 * contents, not the collection itself.
	 */
	public async validateExerciseWriteAccess(
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
		const canEdit = await this.collectionSharingService.hasEditAccess(userId, collectionId);
		if (!canEdit) {
			throw new ForbiddenException("You do not have edit access to this collection");
		}
		return { collection, currentUser };
	}

	/**
	 * Owner, admin, or STUDY / EDIT share holder.
	 * Use for drill (quiz) endpoints — requires at least STUDY level.
	 * VIEW-only shares cannot drill.
	 */
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

	/**
	 * Owner, admin, or any share level (VIEW / STUDY / EDIT).
	 * Use for reading collection metadata, listing exercises, fetching files.
	 */
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
}
