import { ForbiddenException, Injectable } from "@nestjs/common";
import { Collection, User } from "@prisma/client";
import { UsersService } from "src/users/users.service";
import { CollectionsService } from "./collections.service";

@Injectable()
export class CollectionAccessService {
	public constructor(
		private readonly collectionsService: CollectionsService,
		private readonly usersService: UsersService
	) {}
	/**
	 * Validates user access to a collection and returns both collection and user
	 */
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
}
