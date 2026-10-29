import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { BaseService } from "src/base/base.service";
import { Prisma } from "@prisma/client";
import { UserStatsDto } from "./dto/user-stats.dto";
import { SrsService } from "src/srs/srs.service";

type UserWithPermissions = Prisma.UserGetPayload<{
	include: { permissions: true };
}>;

@Injectable()
export class UsersService extends BaseService {
	public constructor(
		private readonly prismaService: PrismaService,
		private readonly srsService: SrsService
	) {
		super();
	}

	public async findUser(userId: string): Promise<UserWithPermissions> {
		const user = await this.prismaService.user.findUnique({
			where: { id: userId },
			include: { permissions: true },
		});
		if (!user) {
			throw new NotFoundException("User not found");
		}
		return user;
	}

	/**
	 * Aggregated profile stats for the current user.
	 *
	 * Streak semantics:
	 *   - currentStreak — trailing consecutive correct answers across ALL of
	 *     the user's attempts (global, not per-collection), ordered by
	 *     createdAt ASC. Resets on any wrong answer.
	 *   - longestStreak — historical maximum streak, same global attempt stream.
	 *
	 * Performance note: attempts for a single user are loaded in one pass.
	 * Fine for hundreds to low thousands of rows (typical). If it ever
	 * becomes a bottleneck, replace the streak walk with a raw SQL window
	 * function and aggregate counts via GROUP BY / COUNT FILTER.
	 */
	public async getStats(userId: string): Promise<UserStatsDto> {
		const [collectionsOwned, collectionsSharedWithMe, exercisesCreated, attempts, srsBreakdown] = await Promise.all(
			[
				this.prismaService.collection.count({ where: { userId } }),
				this.prismaService.collectionShare.count({ where: { userId } }),
				this.prismaService.exercise.count({ where: { collection: { userId } } }),
				this.prismaService.attempt.findMany({
					where: { userId },
					select: { isCorrect: true, createdAt: true },
					orderBy: { createdAt: "asc" },
				}),
				this.srsService.getSrsBreakdown(userId),
			]
		);

		const totalAttempts = attempts.length;
		const correctAttempts = attempts.filter((a): boolean => a.isCorrect).length;
		const accuracy = totalAttempts > 0 ? correctAttempts / totalAttempts : 0;

		let current = 0;
		let longest = 0;
		for (const a of attempts) {
			if (a.isCorrect) {
				current++;
				if (current > longest) longest = current;
			} else {
				current = 0;
			}
		}

		const lastActiveAt = totalAttempts > 0 ? attempts[totalAttempts - 1]!.createdAt : null;

		return this.toResponseDto(UserStatsDto, {
			collectionsOwned,
			collectionsSharedWithMe,
			exercisesCreated,
			totalAttempts,
			correctAttempts,
			accuracy,
			currentStreak: current,
			longestStreak: longest,
			lastActiveAt,
			srsNew: srsBreakdown.new,
			srsLearning: srsBreakdown.learning,
			srsMature: srsBreakdown.mature,
			srsDueForReview: srsBreakdown.dueForReview,
		});
	}

	protected async updateLastLogin(userId: string): Promise<void> {
		await this.prismaService.user.update({
			where: { id: userId },
			data: { lastLogin: new Date() },
		});
	}

	protected async delete(id: string): Promise<void> {
		await this.prismaService.user.delete({ where: { id } });
	}
}
