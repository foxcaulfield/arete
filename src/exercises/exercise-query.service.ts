import { Injectable, NotFoundException } from "@nestjs/common";
import { Exercise, Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class ExerciseQueryService {
	public constructor(private readonly prismaService: PrismaService) {}
	public async getTopMostAttemptedExercises(
		collectionId: string,
		userId: string,
		limit: number = 5,
		skip: number = 0
	): Promise<
		Array<
			Exercise & {
				totalAttempts: number;
				correctAttempts: number;
			}
		>
	> {
		return await this.prismaService.$queryRaw(
			Prisma.sql`
            SELECT
				e.id,
                e.question,
                e."audioUrl"                               AS "audioUrl",
                e."imageUrl"                               AS "imageUrl",
                e.type                                     AS "type",
                e.translation                              AS "translation",
                e.explanation                              AS "explanation",
                e.distractors                              AS "distractors",
                e."collectionId"                           AS "collectionId",
                e."createdAt"                              AS "createdAt",
                e."updatedAt"                              AS "updatedAt",
                e."isActive"                               AS "isActive",
                e."additional_correct_answers"             AS "additionalCorrectAnswers",
                e."correct_answer"                         AS "correctAnswer",
                COALESCE(a.total, 0)    AS "totalAttempts",
                COALESCE(c.correct, 0)  AS "correctAttempts"
            FROM "exercises" e
            LEFT JOIN (
                SELECT "exerciseId", COUNT(*)::int AS total
                FROM "attempts"
                WHERE "userId" = ${userId}
                GROUP BY "exerciseId"
            ) a ON e.id = a."exerciseId"
            LEFT JOIN (
                SELECT "exerciseId", COUNT(*)::int AS correct
                FROM "attempts"
                WHERE "userId" = ${userId} AND "isCorrect" = true
                GROUP BY "exerciseId"
            ) c ON e.id = c."exerciseId"
            WHERE e."collectionId" = ${collectionId}
            ORDER BY COALESCE(a.total, 0) DESC NULLS LAST
            LIMIT ${limit} OFFSET ${skip};
        `
		);
	}
	/**
	 * Retrieves a random active exercise from a collection
	 */
	public async getRandomActiveExercise(collectionId: string): Promise<Exercise> {
		const count = await this.prismaService.exercise.count({
			where: { collectionId, isActive: true },
		});

		if (count === 0) {
			throw new NotFoundException("No exercises available in this collection");
		}

		const offset = Math.floor(Math.random() * count);

		const exercise = await this.prismaService.exercise.findFirst({
			where: { collectionId, isActive: true },
			skip: offset,
			take: 1,
		});

		if (!exercise) {
			throw new NotFoundException("Exercise not found");
		}

		return exercise;
	}
	public async getLeastAttemptedExercise(collectionId: string, userId: string): Promise<Exercise> {
		const baseWhere = { collectionId, isActive: true };

		// // Global least-attempted (no user filter) — use relation count ordering
		// if (!userId) {
		// 	const exercise = await this.prismaService.exercise.findFirst({
		// 		where: baseWhere,
		// 		orderBy: { Attempt: { _count: "asc" } },
		// 	});

		// 	if (!exercise) throw new NotFoundException("Exercise not found");

		// 	return exercise;
		// }

		// Per-user: prefer any exercise with ZERO attempts by this user
		const zeroAttemptExercise = await this.prismaService.exercise.findFirst({
			where: {
				...baseWhere,
				Attempt: { none: { userId } }, // exercises with no attempts by this user
			},
		});
		if (zeroAttemptExercise) return zeroAttemptExercise;

		// Otherwise group attempts by exercise (only attempts by this user and in the collection),
		// pick exerciseId with minimal count and load that exercise.
		const grouped = await this.prismaService.attempt.groupBy({
			by: ["exerciseId"],
			where: {
				userId,
				exercise: { collectionId, isActive: true }, // restrict to the collection
			},
			_count: { _all: true },
		});

		if (grouped.length === 0) {
			throw new NotFoundException("No exercises available in this collection");
		}

		let min = grouped[0]!;
		for (const g of grouped) {
			if (g._count._all < min._count._all) min = g;
		}

		// return this.findExerciseOrFail(min.exerciseId);
		const exercise = await this.prismaService.exercise.findUnique({
			where: { id: min.exerciseId },
		});

		if (!exercise) {
			throw new NotFoundException(`Exercise with ID ${min.exerciseId} not found`);
		}

		return exercise;
	}
}
