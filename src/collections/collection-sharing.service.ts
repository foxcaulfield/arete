import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CollectionAccessLevel } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

export interface ShareDto {
	userId: string;
	name: string | null;
	email: string;
	accessLevel: CollectionAccessLevel;
	grantedAt: Date;
	grantedById: string | null;
	grantedByName: string | null;
}

export interface CollectionAccessMap {
	collectionId: string;
	name: string;
	ownerId: string;
	ownerName: string | null;
	accessLevel: CollectionAccessLevel;
	grantedAt: Date;
}

@Injectable()
export class CollectionSharingService {
	public constructor(private readonly prismaService: PrismaService) {}

	/** Any share row (VIEW / STUDY / EDIT) grants at least view access. */
	public async hasReadAccess(userId: string, collectionId: string): Promise<boolean> {
		const share = await this.prismaService.collectionShare.findUnique({
			where: { collectionId_userId: { collectionId, userId } },
			select: { id: true },
		});
		return share !== null;
	}

	/** STUDY or EDIT grants drill access. */
	public async hasStudyAccess(userId: string, collectionId: string): Promise<boolean> {
		const share = await this.prismaService.collectionShare.findUnique({
			where: { collectionId_userId: { collectionId, userId } },
			select: { accessLevel: true },
		});
		if (!share) return false;

		return [CollectionAccessLevel.STUDY, CollectionAccessLevel.EDIT].some((l): boolean => l === share?.accessLevel);
	}

	public async grant(
		adminId: string,
		collectionId: string,
		granteeId: string,
		accessLevel: CollectionAccessLevel = CollectionAccessLevel.STUDY
	): Promise<ShareDto> {
		const [collection, grantee] = await Promise.all([
			this.prismaService.collection.findUnique({
				where: { id: collectionId },
				select: { id: true, userId: true },
			}),
			this.prismaService.user.findUnique({
				where: { id: granteeId },
				select: { id: true, name: true, email: true },
			}),
		]);

		if (!collection) throw new NotFoundException("Collection not found");
		if (!grantee) throw new NotFoundException("User not found");
		if (collection.userId === granteeId) {
			throw new ConflictException("Cannot grant access to the collection owner");
		}

		const existing = await this.prismaService.collectionShare.findUnique({
			where: { collectionId_userId: { collectionId, userId: granteeId } },
		});
		if (existing) {
			throw new ConflictException("This user already has access to this collection");
		}

		const created = await this.prismaService.collectionShare.create({
			data: { collectionId, userId: granteeId, accessLevel, grantedById: adminId },
			include: {
				user: { select: { id: true, name: true, email: true } },
				grantedBy: { select: { id: true, name: true } },
			},
		});

		return {
			userId: created.user.id,
			name: created.user.name,
			email: created.user.email,
			accessLevel: created.accessLevel,
			grantedAt: created.grantedAt,
			grantedById: created.grantedBy?.id ?? null,
			grantedByName: created.grantedBy?.name ?? null,
		};
	}

	public async revoke(collectionId: string, granteeId: string): Promise<{ success: true }> {
		const existing = await this.prismaService.collectionShare.findUnique({
			where: { collectionId_userId: { collectionId, userId: granteeId } },
		});
		if (!existing) throw new NotFoundException("Share not found");

		await this.prismaService.collectionShare.delete({
			where: { collectionId_userId: { collectionId, userId: granteeId } },
		});
		return { success: true };
	}

	public async listForCollection(collectionId: string): Promise<{
		collection: { id: string; name: string };
		owner: { id: string; name: string | null; email: string };
		grants: ShareDto[];
	}> {
		const collection = await this.prismaService.collection.findUnique({
			where: { id: collectionId },
			include: {
				user: { select: { id: true, name: true, email: true } },
				shares: {
					orderBy: { grantedAt: "desc" },
					include: {
						user: { select: { id: true, name: true, email: true } },
						grantedBy: { select: { id: true, name: true } },
					},
				},
			},
		});
		if (!collection) throw new NotFoundException("Collection not found");

		return {
			collection: { id: collection.id, name: collection.name },
			owner: {
				id: collection.user.id,
				name: collection.user.name,
				email: collection.user.email,
			},
			grants: collection.shares.map((s): ShareDto => ({
				userId: s.user.id,
				name: s.user.name,
				email: s.user.email,
				accessLevel: s.accessLevel,
				grantedAt: s.grantedAt,
				grantedById: s.grantedBy?.id ?? null,
				grantedByName: s.grantedBy?.name ?? null,
			})),
		};
	}

	public async listForUser(userId: string): Promise<{
		owned: Array<{ id: string; name: string }>;
		shared: CollectionAccessMap[];
	}> {
		const user = await this.prismaService.user.findUnique({
			where: { id: userId },
			select: { id: true },
		});
		if (!user) throw new NotFoundException("User not found");

		const [owned, shares] = await Promise.all([
			this.prismaService.collection.findMany({
				where: { userId },
				select: { id: true, name: true },
				orderBy: { name: "asc" },
			}),
			this.prismaService.collectionShare.findMany({
				where: { userId },
				include: {
					collection: {
						select: {
							id: true,
							name: true,
							user: { select: { id: true, name: true } },
						},
					},
				},
				orderBy: { grantedAt: "desc" },
			}),
		]);

		return {
			owned,
			shared: shares.map((s): CollectionAccessMap => ({
				collectionId: s.collection.id,
				name: s.collection.name,
				ownerId: s.collection.user.id,
				ownerName: s.collection.user.name,
				accessLevel: s.accessLevel,
				grantedAt: s.grantedAt,
			})),
		};
	}
}
