import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class CollectionAnalyticsService {
	public constructor(private readonly prismaService: PrismaService) {}
	public async enrichCollectionsForUser<T extends { id: string; _count?: { exercises?: number } }>(
		collections: Array<T>,
		userId: string
	): Promise<Array<T & { attemptCount: number; exerciseCount: number; uniqueExercisesAttempted: number; coverage: string }>> {
		if (!collections?.length) {
			return [];
		}

		const toIds = (e: { id: string }): string => e.id;

		const collectionIds = collections.map(toIds);

		const exercises = await this.prismaService.exercise.findMany({
			where: { collectionId: { in: collectionIds } },
			select: { id: true, collectionId: true },
		});

		if (exercises.length === 0) {
			// No exercises → no attempts
			return collections.map((c): T & { attemptCount: number; exerciseCount: number; uniqueExercisesAttempted: number; coverage: string } => ({
				...c,
				attemptCount: 0,
				exerciseCount: c?._count?.exercises ?? 0,
				uniqueExercisesAttempted: 0,
				coverage: "0",
			}));
		}

		const exerciseIds = exercises.map(toIds);
		const exerciseToCollectionMap = new Map(exercises.map((e): [string, string] => [e.id, e.collectionId]));

		const attemptCounts = await this.prismaService.attempt.groupBy({
			by: ["exerciseId"],
			where: { userId, exerciseId: { in: exerciseIds } },
			_count: { id: true },
		});

		// Aggregate attempts and unique exercises by collection
		const collectionAttemptMap = new Map<string, number>();
		const collectionUniqueExercisesMap = new Map<string, Set<string>>();

		for (const { exerciseId, _count } of attemptCounts) {
			const collectionId = exerciseToCollectionMap.get(exerciseId);
			if (!collectionId) continue;

			// Total attempts
			const currentAttempts = collectionAttemptMap.get(collectionId) || 0;
			collectionAttemptMap.set(collectionId, currentAttempts + _count.id);

			// Unique exercises attempted
			if (!collectionUniqueExercisesMap.has(collectionId)) {
				collectionUniqueExercisesMap.set(collectionId, new Set());
			}
			collectionUniqueExercisesMap.get(collectionId)!.add(exerciseId);
		}

		// Count exercises per collection
		const collectionExerciseCountMap = new Map<string, number>();
		for (const exercise of exercises) {
			const current = collectionExerciseCountMap.get(exercise.collectionId) || 0;
			collectionExerciseCountMap.set(exercise.collectionId, current + 1);
		}

		// Enrich collections with attempt counts and coverage
		const collectionsWithAttempts = collections.map((c): T & { attemptCount: number; exerciseCount: number; uniqueExercisesAttempted: number; coverage: string } => {
			const exerciseCount = c?._count?.exercises || collectionExerciseCountMap.get(c.id) || 0;
			const uniqueExercisesAttempted = collectionUniqueExercisesMap.get(c.id)?.size || 0;
			const coverage = exerciseCount > 0 ? ((uniqueExercisesAttempted / exerciseCount) * 100).toFixed(0) : "0";

			return {
				...c,
				attemptCount: collectionAttemptMap.get(c.id) || 0,
				exerciseCount,
				uniqueExercisesAttempted,
				coverage,
			};
		});

		return collectionsWithAttempts;
	}
}
