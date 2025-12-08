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

export interface QuizSessionStats {
	correct: number;
	total: number;
	streak: number;
	maxStreak: number;
}

export interface IQuizSessionStore {
	getOrCreateSession(userId: string, collectionId: string): QuizSession;
	resetSession(userId: string, collectionId: string): void;
	getSessionStats(userId: string, collectionId: string): QuizSessionStats;
	recordAnswer(userId: string, collectionId: string, exerciseId: string, isCorrect: boolean): QuizSessionStats;
	hasAnsweredExercise(userId: string, collectionId: string, exerciseId: string): boolean;
}

export const QUIZ_SESSION_STORE = Symbol("QUIZ_SESSION_STORE");

@Injectable()
export class InMemoryQuizSessionStore implements IQuizSessionStore {
	private sessions: Map<string, QuizSession> = new Map();

	private getSessionKey(userId: string, collectionId: string): string {
		return `${userId}:${collectionId}`;
	}

	public getOrCreateSession(userId: string, collectionId: string): QuizSession {
		const sessionKey = this.getSessionKey(userId, collectionId);
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
		const sessionKey = this.getSessionKey(userId, collectionId);
		this.sessions.delete(sessionKey);
	}

	public getSessionStats(userId: string, collectionId: string): QuizSessionStats {
		const session = this.getOrCreateSession(userId, collectionId);
		return {
			correct: session.correct,
			total: session.total,
			streak: session.streak,
			maxStreak: session.maxStreak,
		};
	}

	public recordAnswer(
		userId: string,
		collectionId: string,
		exerciseId: string,
		isCorrect: boolean
	): QuizSessionStats {
		const session = this.getOrCreateSession(userId, collectionId);

		session.total++;
		session.answeredExerciseIds.add(exerciseId);

		if (isCorrect) {
			session.correct++;
			session.streak++;
			if (session.streak > session.maxStreak) {
				session.maxStreak = session.streak;
			}
		} else {
			session.streak = 0;
		}

		return {
			correct: session.correct,
			total: session.total,
			streak: session.streak,
			maxStreak: session.maxStreak,
		};
	}

	public hasAnsweredExercise(userId: string, collectionId: string, exerciseId: string): boolean {
		const session = this.sessions.get(this.getSessionKey(userId, collectionId));
		return session?.answeredExerciseIds.has(exerciseId) ?? false;
	}
}
