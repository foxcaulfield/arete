import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { UserSession } from "@thallesp/nestjs-better-auth";
import { DashboardStats } from "./dashboard-stats.interface";

@Injectable()
export class UiService {
  constructor(private readonly prismaService: PrismaService) {}

  async getDashboard(
    session: UserSession,
    view?: string
  ): Promise<{
    title: string;
    stats: DashboardStats;
    randomCollectionId: string | null;
    isAdmin: boolean;
    viewMode: string;
  }> {
    const userId = session.user.id;

    // Check if user is admin
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = user?.role === "ADMIN";
    // "mine" = stats from my own collections only
    // "all" = all my activity (including attempts on other users' collections)
    const viewMode = isAdmin && view === "all" ? "all" : "mine";

    // Get user's own collections (always)
    const myCollections = await this.prismaService.collection.findMany({
      where: { userId },
      select: { id: true },
    });
    const myCollectionsCount = myCollections.length;

    // Pick a random collection for "Quick Quiz" (from user's own collections)
    const randomCollection = myCollections[Math.floor(Math.random() * myCollections.length)];
    const randomCollectionId = randomCollection?.id ?? null;

    // Get exercises count from user's own collections
    const myExercisesCount = await this.prismaService.exercise.count({
      where: { collection: { userId } },
    });

    if (viewMode === "mine") {
      // Stats only from MY OWN collections
      const myCollectionIds = myCollections.map((c) => c.id);

      // Get attempts on exercises from my collections only
      const attemptsData = await this.prismaService.attempt.groupBy({
        by: ["isCorrect"],
        where: {
          userId,
          exercise: { collectionId: { in: myCollectionIds } },
        },
        _count: { id: true },
      });

      const totalAttempts = attemptsData.reduce((sum, a) => sum + a._count.id, 0);
      const correctAttempts = attemptsData.find((a) => a.isCorrect)?._count.id || 0;
      const accuracy = totalAttempts > 0 ? ((correctAttempts / totalAttempts) * 100).toFixed(1) : "0";

      // Coverage: unique exercises attempted from my collections
      const uniqueExercisesAttempted = await this.prismaService.attempt.groupBy({
        by: ["exerciseId"],
        where: {
          userId,
          exercise: { collectionId: { in: myCollectionIds } },
        },
      });

      const coverage =
        myExercisesCount > 0
          ? ((uniqueExercisesAttempted.length / myExercisesCount) * 100).toFixed(1)
          : "0";

      return {
        title: "Dashboard",
        stats: {
          collections: myCollectionsCount,
          exercises: myExercisesCount,
          attempts: totalAttempts,
          correctAttempts,
          accuracy,
          coverage,
          uniqueExercisesAttempted: uniqueExercisesAttempted.length,
        },
        randomCollectionId,
        isAdmin,
        viewMode,
      };
    } else if (viewMode === "all") {
      // Stats from ALL my attempts (including other users' collections)
      const attemptsData = await this.prismaService.attempt.groupBy({
        by: ["isCorrect"],
        where: { userId },
        _count: { id: true },
      });

      const totalAttempts = attemptsData.reduce((sum, a) => sum + a._count.id, 0);
      const correctAttempts = attemptsData.find((a) => a.isCorrect)?._count.id || 0;
      const accuracy = totalAttempts > 0 ? ((correctAttempts / totalAttempts) * 100).toFixed(1) : "0";

      // Get unique exercises I've attempted (from any collection)
      const uniqueExercisesAttempted = await this.prismaService.attempt.groupBy({
        by: ["exerciseId"],
        where: { userId },
      });

      // Get total exercises I have access to (all exercises since I'm admin)
      const totalAccessibleExercises = await this.prismaService.exercise.count();

      // Count collections I've practiced from
      const collectionsAttempted = await this.prismaService.attempt.findMany({
        where: { userId },
        select: { exercise: { select: { collectionId: true } } },
        distinct: ["exerciseId"],
      });
      const uniqueCollectionsPracticed = new Set(collectionsAttempted.map((a) => a.exercise.collectionId)).size;

      const coverage =
        totalAccessibleExercises > 0
          ? ((uniqueExercisesAttempted.length / totalAccessibleExercises) * 100).toFixed(1)
          : "0";

      return {
        title: "Dashboard",
        stats: {
          collections: uniqueCollectionsPracticed, // Collections I've practiced from
          exercises: totalAccessibleExercises,
          attempts: totalAttempts,
          correctAttempts,
          accuracy,
          coverage,
          uniqueExercisesAttempted: uniqueExercisesAttempted.length,
        },
        randomCollectionId,
        isAdmin,
        viewMode,
      };
    } else {
      // Fallback (should not happen)
      return {
        title: "Dashboard",
        stats: {
          collections: myCollectionsCount,
          exercises: myExercisesCount,
          attempts: 0,
          correctAttempts: 0,
          accuracy: "0",
          coverage: "0",
          uniqueExercisesAttempted: 0,
        },
        randomCollectionId,
        isAdmin,
        viewMode,
      };
    }
  }

  async getProfile(session: UserSession): Promise<object> {
    const userId = session.user.id;

    // Get full user data
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        role: true,
        createdAt: true,
        image: true,
      },
    });

    // Get user stats
    const [collectionsCount, exercisesCount, attemptsData] = await Promise.all([
      this.prismaService.collection.count({ where: { userId } }),
      this.prismaService.exercise.count({ where: { collection: { userId } } }),
      this.prismaService.attempt.aggregate({
        where: { userId },
        _count: { id: true },
      }),
    ]);

    // Get correct attempts count
    const correctAttempts = await this.prismaService.attempt.count({
      where: { userId, isCorrect: true },
    });

    const totalAttempts = attemptsData._count.id;
    const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

    return {
      title: "Profile",
      name: user?.name || session.user.name,
      email: user?.email || session.user.email,
      role: user?.role || "USER",
      createdAt: user?.createdAt,
      image: user?.image,
      stats: {
        collections: collectionsCount,
        exercises: exercisesCount,
        attempts: totalAttempts,
        correctAttempts,
        accuracy,
      },
    };
  }
}
