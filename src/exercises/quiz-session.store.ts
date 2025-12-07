import { Injectable } from "@nestjs/common";

export interface QuizSession {
    collectionId: string;
    userId: string;
    correct: number;
    total: number;
    streak: number;
    maxStreak: number;
    startedAt: Date;
    answeredExerciseIds: Set<string>;
}

@Injectable()
export class QuizSessionStore {
    // In-memory map keyed by `${userId}:${collectionId}`. This is intentionally
    // encapsulated so it can be replaced with Redis or another store later.
    private sessions: Map<string, QuizSession> = new Map();

    public getOrCreateSession(userId: string, collectionId: string): QuizSession {
        const sessionKey = `${userId}:${collectionId}`;
        let session = this.sessions.get(sessionKey);

        if (!session) {
            session = {
                collectionId,
                userId,
                correct: 0,
                total: 0,
                streak: 0,
                maxStreak: 0,
                startedAt: new Date(),
                answeredExerciseIds: new Set<string>(),
            };
            this.sessions.set(sessionKey, session);
        }

        return session;
    }

    public resetSession(userId: string, collectionId: string): void {
        const sessionKey = `${userId}:${collectionId}`;
        this.sessions.delete(sessionKey);
    }

    public getSessionStats(userId: string, collectionId: string): { correct: number; total: number; streak: number; maxStreak: number } {
        const session = this.getOrCreateSession(userId, collectionId);
        return {
            correct: session.correct,
            total: session.total,
            streak: session.streak,
            maxStreak: session.maxStreak,
        };
    }
}
