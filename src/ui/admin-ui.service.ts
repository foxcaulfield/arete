import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { UserSession } from "@thallesp/nestjs-better-auth";

@Injectable()
export class AdminUiService {
	public constructor(private readonly prismaService: PrismaService) {}

	public async getAdminDashboard(): Promise<object> {
		const [usersCount, collectionsCount, exercisesCount, attemptsCount] = await Promise.all([
			this.prismaService.user.count(),
			this.prismaService.collection.count(),
			this.prismaService.exercise.count(),
			this.prismaService.attempt.count(),
		]);
		const recentUsers = await this.prismaService.user.findMany({
			take: 5,
			orderBy: { createdAt: "desc" },
			select: { id: true, name: true, email: true, role: true, createdAt: true },
		});
		return {
			title: "Admin Dashboard",
			stats: {
				users: usersCount,
				collections: collectionsCount,
				exercises: exercisesCount,
				attempts: attemptsCount,
			},
			recentUsers,
		};
	}

	public async getAdminCollections(
		_session: UserSession,
		page: string = "1",
		limit: string = "20",
		search?: string
	): Promise<object> {
		const pageNum = parseInt(page) || 1;
		const limitNum = parseInt(limit) || 20;
		const skip = (pageNum - 1) * limitNum;
		const where = search
			? {
					OR: [
						{ name: { contains: search, mode: "insensitive" as const } },
						{ description: { contains: search, mode: "insensitive" as const } },
						{ user: { name: { contains: search, mode: "insensitive" as const } } },
						{ user: { email: { contains: search, mode: "insensitive" as const } } },
					],
				}
			: {};
		const [collections, total] = await Promise.all([
			this.prismaService.collection.findMany({
				where,
				skip,
				take: limitNum,
				orderBy: { updatedAt: "desc" },
				include: {
					user: { select: { id: true, name: true, email: true } },
					_count: { select: { exercises: true } },
				},
			}),
			this.prismaService.collection.count({ where }),
		]);
		const totalPages = Math.ceil(total / limitNum);
		return {
			title: "All Collections - Admin",
			collections,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total,
				totalPages,
				hasNext: pageNum < totalPages,
				hasPrev: pageNum > 1,
			},
			search: search || "",
		};
	}

	public async getAdminUsers(
		_session: UserSession,
		page: string = "1",
		limit: string = "20",
		search?: string
	): Promise<object> {
		const pageNum = parseInt(page) || 1;
		const limitNum = parseInt(limit) || 20;
		const skip = (pageNum - 1) * limitNum;
		const where = search
			? {
					OR: [
						{ name: { contains: search, mode: "insensitive" as const } },
						{ email: { contains: search, mode: "insensitive" as const } },
					],
				}
			: {};
		const [users, total] = await Promise.all([
			this.prismaService.user.findMany({
				where,
				skip,
				take: limitNum,
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					name: true,
					email: true,
					role: true,
					createdAt: true,
					isActive: true,
					_count: { select: { collections: true, Attempt: true } },
				},
			}),
			this.prismaService.user.count({ where }),
		]);
		const totalPages = Math.ceil(total / limitNum);
		return {
			title: "All Users - Admin",
			users,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total,
				totalPages,
				hasNext: pageNum < totalPages,
				hasPrev: pageNum > 1,
			},
			search: search || "",
		};
	}

	public getAdminUserCreate(): object {
		return {
			title: "Create User - Admin",
		};
	}

	public async getAdminUserDetail(userId: string): Promise<object> {
		const user = await this.prismaService.user.findUnique({
			where: { id: userId },
			include: {
				_count: { select: { collections: true, Attempt: true } },
			},
		});

		if (!user) {
			return { error: "User not found", title: "Admin" };
		}

		// Get user's collections
		const collections = await this.prismaService.collection.findMany({
			where: { userId },
			take: 5,
			orderBy: { updatedAt: "desc" },
			include: { _count: { select: { exercises: true } } },
		});

		// Get recent attempts
		const recentAttempts = await this.prismaService.attempt.findMany({
			where: { userId },
			take: 10,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				answer: true,
				isCorrect: true,
				createdAt: true,
				exercise: {
					select: {
						question: true,
						collection: { select: { name: true } },
					},
				},
			},
		});

		// Calculate accuracy
		const attemptStats = await this.prismaService.attempt.groupBy({
			by: ["isCorrect"],
			where: { userId },
			_count: { id: true },
		});
		const totalAttempts = attemptStats.reduce((sum, a): number => sum + a._count.id, 0);
		const correctAttempts =
			attemptStats.find((a): a is { isCorrect: true; _count: { id: number } } => a.isCorrect)?._count.id || 0;
		const accuracy = totalAttempts > 0 ? ((correctAttempts / totalAttempts) * 100).toFixed(1) : "0";

		return {
			title: `${user.name} - Admin`,
			user,
			collections,
			recentAttempts,
			stats: {
				collections: user._count.collections,
				attempts: totalAttempts,
				correctAttempts,
				accuracy,
			},
		};
	}

	public async getAdminUserEdit(userId: string): Promise<object> {
		const user = await this.prismaService.user.findUnique({
			where: { id: userId },
		});

		if (!user) {
			return { error: "User not found", title: "Admin" };
		}

		return {
			title: `Edit ${user.name} - Admin`,
			user,
		};
	}

	public async getAdminExercises(
		page: string = "1",
		limit: string = "30",
		search?: string,
		filter?: string
	): Promise<object> {
		const pageNum = parseInt(page) || 1;
		const limitNum = parseInt(limit) || 30;
		const skip = (pageNum - 1) * limitNum;

		// Handle orphans filter (exercises with deleted collections)
		if (filter === "orphans") {
			// Get all collectionIds that exist
			const existingCollections = await this.prismaService.collection.findMany({
				select: { id: true },
			});
			const existingCollectionIds = new Set(existingCollections.map((c): string => c.id));

			// Get all exercises
			const allExercises = await this.prismaService.exercise.findMany({
				orderBy: { updatedAt: "desc" },
			});

			// Filter orphans (collectionId not in existing collections)
			const orphanExercises = allExercises.filter((e): boolean => !existingCollectionIds.has(e.collectionId));
			const total = orphanExercises.length;
			const paginatedOrphans = orphanExercises.slice(skip, skip + limitNum);

			// Map to include null collection info
			const exercises = paginatedOrphans.map(
				(e): (typeof paginatedOrphans)[number] & { collection: null; orphanCollectionId: string } => ({
					...e,
					collection: null,
					orphanCollectionId: e.collectionId,
				})
			);

			const totalPages = Math.ceil(total / limitNum);

			// Get summary stats
			const totalExercises = await this.prismaService.exercise.count();

			return {
				title: "Orphan Exercises - Admin",
				exercises,
				pagination: {
					page: pageNum,
					limit: limitNum,
					total,
					totalPages,
					hasNext: pageNum < totalPages,
					hasPrev: pageNum > 1,
				},
				search: "",
				filter: "orphans",
				stats: {
					total: totalExercises,
					orphans: orphanExercises.length,
				},
			};
		}

		// Normal query with search
		const whereConditions: any[] = [];

		if (search) {
			whereConditions.push({
				OR: [
					{ question: { contains: search, mode: "insensitive" as const } },
					// 'answer' doesn't exist on the Exercise model. Search correctAnswer instead
					{ correctAnswer: { contains: search, mode: "insensitive" as const } },
					// also search explanation/translation text fields for matches
					{ explanation: { contains: search, mode: "insensitive" as const } },
					{ translation: { contains: search, mode: "insensitive" as const } },
					{ collection: { name: { contains: search, mode: "insensitive" as const } } },
					{ collection: { user: { name: { contains: search, mode: "insensitive" as const } } } },
				],
			});
		}

		const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

		const [exercises, total] = await Promise.all([
			this.prismaService.exercise.findMany({
				where,
				skip,
				take: limitNum,
				orderBy: { updatedAt: "desc" },
				include: {
					collection: {
						select: {
							id: true,
							name: true,
							user: { select: { id: true, name: true } },
						},
					},
				},
			}),
			this.prismaService.exercise.count({ where }),
		]);

		const totalPages = Math.ceil(total / limitNum);

		// Get orphan count
		const existingCollectionIds = await this.prismaService.collection.findMany({ select: { id: true } });
		const existingIds = new Set(existingCollectionIds.map((c): string => c.id));
		const allExerciseCollectionIds = await this.prismaService.exercise.findMany({ select: { collectionId: true } });
		const orphanCount = allExerciseCollectionIds.filter((e): boolean => !existingIds.has(e.collectionId)).length;

		const totalExercises = await this.prismaService.exercise.count();

		return {
			title: "All Exercises - Admin",
			exercises,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total,
				totalPages,
				hasNext: pageNum < totalPages,
				hasPrev: pageNum > 1,
			},
			search: search || "",
			filter: filter || "",
			stats: {
				total: totalExercises,
				orphans: orphanCount,
			},
		};
	}

	public async getAdminAttempts(
		page: string = "1",
		limit: string = "30",
		search?: string,
		result?: string,
		filter?: string
	): Promise<object> {
		const pageNum = parseInt(page) || 1;
		const limitNum = parseInt(limit) || 30;
		const skip = (pageNum - 1) * limitNum;

		// Handle orphans filter separately (attempts with deleted exercises)
		if (filter === "orphans") {
			// Get all exerciseIds that exist
			const existingExercises = await this.prismaService.exercise.findMany({
				select: { id: true },
			});
			const existingExerciseIds = new Set(existingExercises.map((e): string => e.id));

			// Get all attempts
			const allAttempts = await this.prismaService.attempt.findMany({
				orderBy: { createdAt: "desc" },
				include: {
					user: { select: { id: true, name: true, email: true } },
				},
			});

			// Filter orphans (exerciseId not in existing exercises)
			const orphanAttempts = allAttempts.filter((a): boolean => !existingExerciseIds.has(a.exerciseId));
			const total = orphanAttempts.length;
			const paginatedOrphans = orphanAttempts.slice(skip, skip + limitNum);

			// Map to include null exercise info
			const attempts = paginatedOrphans.map(
				(a): (typeof paginatedOrphans)[number] & { exercise: null; orphanExerciseId: string } => ({
					...a,
					exercise: null,
					orphanExerciseId: a.exerciseId,
				})
			);

			const totalPages = Math.ceil(total / limitNum);

			// Get summary stats
			const [totalAttempts, correctAttempts, orphanCount] = await Promise.all([
				this.prismaService.attempt.count(),
				this.prismaService.attempt.count({ where: { isCorrect: true } }),
				Promise.resolve(orphanAttempts.length),
			]);

			return {
				title: "Orphan Attempts - Admin",
				attempts,
				pagination: {
					page: pageNum,
					limit: limitNum,
					total,
					totalPages,
					hasNext: pageNum < totalPages,
					hasPrev: pageNum > 1,
				},
				search: "",
				result: "",
				filter: "orphans",
				stats: {
					total: totalAttempts,
					correct: correctAttempts,
					accuracy: totalAttempts > 0 ? ((correctAttempts / totalAttempts) * 100).toFixed(1) : "0",
					orphans: orphanCount,
				},
			};
		}

		// Build where clause for normal queries
		const whereConditions: any[] = [];

		if (search) {
			whereConditions.push({
				OR: [
					{ user: { name: { contains: search, mode: "insensitive" as const } } },
					{ user: { email: { contains: search, mode: "insensitive" as const } } },
					{ exercise: { question: { contains: search, mode: "insensitive" as const } } },
					{ exercise: { collection: { name: { contains: search, mode: "insensitive" as const } } } },
				],
			});
		}

		if (result === "correct") {
			whereConditions.push({ isCorrect: true });
		} else if (result === "incorrect") {
			whereConditions.push({ isCorrect: false });
		}

		const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

		const [attempts, total] = await Promise.all([
			this.prismaService.attempt.findMany({
				where,
				skip,
				take: limitNum,
				orderBy: { createdAt: "desc" },
				include: {
					user: { select: { id: true, name: true, email: true } },
					exercise: {
						select: {
							id: true,
							question: true,
							collection: { select: { id: true, name: true } },
						},
					},
				},
			}),
			this.prismaService.attempt.count({ where }),
		]);

		const totalPages = Math.ceil(total / limitNum);

		// Get summary stats including orphan count
		const existingExerciseIds = await this.prismaService.exercise.findMany({ select: { id: true } });
		const existingIds = new Set(existingExerciseIds.map((e): string => e.id));
		const allAttemptExerciseIds = await this.prismaService.attempt.findMany({ select: { exerciseId: true } });
		const orphanCount = allAttemptExerciseIds.filter((a): boolean => !existingIds.has(a.exerciseId)).length;

		const [totalAttempts, correctAttempts] = await Promise.all([
			this.prismaService.attempt.count(),
			this.prismaService.attempt.count({ where: { isCorrect: true } }),
		]);

		return {
			title: "All Attempts - Admin",
			attempts,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total,
				totalPages,
				hasNext: pageNum < totalPages,
				hasPrev: pageNum > 1,
			},
			search: search || "",
			result: result || "",
			filter: filter || "",
			stats: {
				total: totalAttempts,
				correct: correctAttempts,
				accuracy: totalAttempts > 0 ? ((correctAttempts / totalAttempts) * 100).toFixed(1) : "0",
				orphans: orphanCount,
			},
		};
	}
}
