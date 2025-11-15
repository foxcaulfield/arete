import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class CollectionAnalyticsService {
	public constructor(private readonly prismaService: PrismaService) {}
	public async enrichCollectionsForUser<T extends { id: string; _count?: { exercises?: number } }>(
		collections: Array<T>,
		userId: string
	): Promise<Array<T & { attemptCount: number; exerciseCount: number }>> {
		if (!collections?.length) {
			return [];
		}

		// const collectionsIds = collections.map((c): string => c.id);

		const toIds = (e: { id: string }): string => e.id;

		const collectionIds = collections.map(toIds);

		const exercises = await this.prismaService.exercise.findMany({
			where: { collectionId: { in: collectionIds } },
			select: { id: true, collectionId: true },
		});

		if (exercises.length === 0) {
			// No exercises → no attempts
			return collections.map((c): T & { attemptCount: number; exerciseCount: number } => ({
				...c,
				attemptCount: 0,
				exerciseCount: c?._count?.exercises ?? 0,
			}));
		}

		const exerciseIds = exercises.map(toIds);
		const exerciseToCollectionMap = new Map(exercises.map((e): [string, string] => [e.id, e.collectionId]));

		const attemptCounts = await this.prismaService.attempt.groupBy({
			by: ["exerciseId"],
			where: { userId, exerciseId: { in: exerciseIds } },
			_count: { id: true },
		});

		// Aggregate attempts by collection
		const collectionAttemptMap = new Map<string, number>();
		for (const { exerciseId, _count } of attemptCounts) {
			const collectionId = exerciseToCollectionMap.get(exerciseId);
			if (!collectionId) continue;
			const current = collectionAttemptMap.get(collectionId) || 0;
			collectionAttemptMap.set(collectionId, current + _count.id);
		}

		// Enrich collections with attempt counts
		const collectionsWithAttempts = collections.map((c): T & { attemptCount: number; exerciseCount: number } => ({
			...c,
			attemptCount: collectionAttemptMap.get(c.id) || 0,
			exerciseCount: c?._count?.exercises || 0,
		}));

		return collectionsWithAttempts;
	}
}
