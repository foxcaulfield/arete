import { Injectable } from "@nestjs/common";
import { CardState, Exercise } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

export interface Sm2State {
	easiness: number;
	repetitions: number;
	interval: number;
	lapses: number;
}

export interface Sm2Result {
	easiness: number;
	repetitions: number;
	interval: number;
	nextReviewAt: Date;
	lastReviewedAt: Date;
	lapses: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASINESS = 1.3;
const MAX_INTERVAL_DAYS = 365 * 10;
const DEFAULT_STATE: Sm2State = { easiness: 2.5, repetitions: 0, interval: 0, lapses: 0 };

/**
 * SM-2 spaced repetition scheduler (SuperMemo 2, 1987).
 *
 * Binary feedback mapping:
 *   wasCorrect=true  → q=4 (good recall, ease-neutral)
 *   wasCorrect=false → q=2 (failed recall, ease drops 0.32, interval resets)
 *
 * Ease:  EF' = EF + (0.1 − (5−q) · (0.08 + (5−q) · 0.02))
 *        q=4 → +0.00   q=2 → −0.32   q=5 → +0.10   q=0 → −0.80
 * Clamped to [1.3, ∞).
 *
 * Interval (on q ≥ 3):
 *   repetitions=0 → 1 day
 *   repetitions=1 → 6 days
 *   repetitions≥2 → round(interval · easiness)
 *   Capped at MAX_INTERVAL_DAYS (10 years) to prevent overflow.
 *
 * On failure (q < 3):
 *   repetitions=0, interval=1 day, lapses++  (ease unchanged — canonical SM-2)
 *
 * To support 4-grade feedback later (Again/Hard/Good/Easy), map to
 * q ∈ {1, 3, 4, 5} and pass through — the rest of the algorithm is unchanged.
 */
export function scheduleSm2(state: Sm2State, wasCorrect: boolean, now: Date = new Date()): Sm2Result {
	const q = wasCorrect ? 4 : 2;
	const delta = 5 - q;
	const newEasiness = Math.max(MIN_EASINESS, state.easiness + (0.1 - delta * (0.08 + delta * 0.02)));

	let newInterval: number;
	let newRepetitions: number;
	let newLapses = state.lapses;

	if (q >= 3) {
		if (state.repetitions === 0) newInterval = 1;
		else if (state.repetitions === 1) newInterval = 6;
		else newInterval = Math.round(state.interval * newEasiness);
		newRepetitions = state.repetitions + 1;
	} else {
		newRepetitions = 0;
		newInterval = 1;
		newLapses = state.lapses + 1;
	}

	newInterval = Math.min(newInterval, MAX_INTERVAL_DAYS);

	return {
		easiness: newEasiness,
		repetitions: newRepetitions,
		interval: newInterval,
		nextReviewAt: new Date(now.getTime() + newInterval * DAY_MS),
		lastReviewedAt: now,
		lapses: newLapses,
	};
}

@Injectable()
export class SrsService {
	public constructor(private readonly prisma: PrismaService) {}

	public async scheduleReview(userId: string, exerciseId: string, wasCorrect: boolean): Promise<CardState> {
		const existing = await this.prisma.cardState.findUnique({
			where: { userId_exerciseId: { userId, exerciseId } },
		});
		const state: Sm2State = existing
			? {
					easiness: existing.easiness,
					repetitions: existing.repetitions,
					interval: existing.interval,
					lapses: existing.lapses,
				}
			: DEFAULT_STATE;
		const result = scheduleSm2(state, wasCorrect);

		if (existing) {
			return this.prisma.cardState.update({
				where: { id: existing.id },
				data: {
					easiness: result.easiness,
					repetitions: result.repetitions,
					interval: result.interval,
					nextReviewAt: result.nextReviewAt,
					lastReviewedAt: result.lastReviewedAt,
					lapses: result.lapses,
				},
			});
		}
		return this.prisma.cardState.create({
			data: {
				userId,
				exerciseId,
				easiness: result.easiness,
				repetitions: result.repetitions,
				interval: result.interval,
				nextReviewAt: result.nextReviewAt,
				lastReviewedAt: result.lastReviewedAt,
				lapses: result.lapses,
			},
		});
	}

	public async getCardState(userId: string, exerciseId: string): Promise<CardState | null> {
		return this.prisma.cardState.findUnique({
			where: { userId_exerciseId: { userId, exerciseId } },
		});
	}

	/**
	 * Due exercises for a user, optionally scoped to a collection.
	 *
	 * "Due" = no CardState yet (new) OR CardState.nextReviewAt <= now (review).
	 * Sort priority: due reviews first by earliest nextReviewAt, then new cards.
	 *
	 * Implemented via 3 Prisma queries (no raw SQL) so it works identically on
	 * Postgres and SQLite without database-specific type quirks. Efficient:
	 * each query hits an index and returns IDs only, then one more query
	 * hydrates the actual exercise rows.
	 */
	public async getDueExercises(
		userId: string,
		collectionId: string | undefined,
		limit = 20,
		skip = 0
	): Promise<Exercise[]> {
		const now = new Date();
		const baseWhere = { isActive: true, ...(collectionId ? { collectionId } : {}) };

		const dueStates = await this.prisma.cardState.findMany({
			where: { userId, nextReviewAt: { lte: now }, exercise: baseWhere },
			orderBy: { nextReviewAt: "asc" },
			select: { exerciseId: true },
			take: limit + skip,
		});
		const dueIds = dueStates.map((s): string => s.exerciseId);

		let newIds: string[] = [];
		const remaining = limit + skip - dueIds.length;
		if (remaining > 0) {
			const newExercises = await this.prisma.exercise.findMany({
				where: { ...baseWhere, cardStates: { none: { userId } } },
				orderBy: { createdAt: "asc" },
				select: { id: true },
				take: remaining,
			});
			newIds = newExercises.map((e): string => e.id);
		}

		const allIds = [...dueIds, ...newIds].slice(skip, skip + limit);
		if (allIds.length === 0) return [];

		const exercises = await this.prisma.exercise.findMany({ where: { id: { in: allIds } } });
		const byId = new Map(exercises.map((e): [string, Exercise] => [e.id, e]));
		return allIds.map((id): Exercise | undefined => byId.get(id)).filter((e): e is Exercise => e !== undefined);
	}

	public async getDueCount(userId: string, collectionId?: string): Promise<number> {
		const now = new Date();
		const baseWhere = { isActive: true, ...(collectionId ? { collectionId } : {}) };
		const [dueCount, newCount] = await Promise.all([
			this.prisma.cardState.count({
				where: { userId, nextReviewAt: { lte: now }, exercise: baseWhere },
			}),
			this.prisma.exercise.count({
				where: { ...baseWhere, cardStates: { none: { userId } } },
			}),
		]);
		return dueCount + newCount;
	}
}
