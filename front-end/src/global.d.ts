// Global ambient types — available everywhere without imports.
// Trimmed from the SvelteKit project's src/app.d.ts — SvelteKit-specific
// App.Locals / App.PageData / $lib/server references removed.

declare global {
	interface PaginatedResponse<T> {
		data: T[];
		pagination: {
			page: number;
			limit: number;
			totalItems: number;
			totalPages: number;
			hasNextPage: boolean;
			hasPreviousPage: boolean;
		};
	}

	/* Collection Interfaces */
	namespace Collection {
		interface CreateDto {
			name: string;
			description?: string;
		}

		interface UpdateDto {
			name?: string;
			description?: string;
		}
		type MyAccessLevel = "OWNER" | "ADMIN" | "EDIT" | "STUDY" | "VIEW";

		interface ResponseDto {
			id: string;
			name: string;
			description: string;
			user: {
				id: string;
				name?: string;
			};
			createdAt: Date;
			updatedAt: Date;
			attemptCount: number;
			exerciseCount: number;
			myAccessLevel?: MyAccessLevel;
			canManageSharing?: boolean;
			dueCount?: number;
		}
	}

	/* Exercise Interfaces */
	namespace Exercise {
		type ExerciseType = "FILL_IN_THE_BLANK" | "CHOICE_SINGLE";

		interface ResponseDto {
			id: string;
			question: string;
			audioUrl: string | null;
			imageUrl: string | null;
			type: ExerciseType;
			translation: string | null;
			explanation: string | null;
			distractors: string[] | null;
			collectionId: string;
			createdAt: string;
			updatedAt: string;
			isActive: boolean;
			additionalCorrectAnswers: string[] | null;
			correctAnswer: string | null;
			totalAttempts: number;
			correctAttempts: number;
			myAccessLevel?: Collection.MyAccessLevel | null;
		}

		interface CreateDto {
			collectionId: string;
			type: ExerciseType;
			question: string;
			correctAnswer: string;
			additionalCorrectAnswers?: string[];
			distractors?: string[];
			explanation?: string;
		}

		type UpdateDto = Partial<CreateDto>;
	}

	/* Quiz Interfaces */
	namespace Quiz {
		interface QuestionDto {
			id: string;
			question: string;
			audioUrl?: string | null;
			imageUrl?: string | null;
			type: Exercise.ExerciseType;
			translation?: string | null;
			explanation?: string | null;
			distractors?: string[] | null;
			totalExercises?: number;
			exercisesWithAttempts?: number;
			collectionId?: string;
			collectionName?: string | null;
		}

		interface UserAnswerFeedbackDto {
			isCorrect: boolean;
			correctAnswer: string;
			explanation?: string;
			nextExerciseId?: string;
			nextReviewAt?: string | null;
		}

		interface UserAnswerDto {
			exerciseId: string;
			userAnswer: string;
		}

		interface CollectionStatsDto {
			totalExercises: number;
			exercisesWithAttempts: number;
			totalAttempts: number;
			correctAttempts: number;
			accuracy: number; // 0..1
			streak: number;
			maxStreak: number;
		}
	}

	interface CustomApiErrorInterface {
		requestStatusCode: number;
		errorText: string;
	}

	interface AccessFlags {
		unauthorized?: boolean;
		forbidden?: boolean;
		notFound?: boolean;
		errorText?: string;
		unknownError?: boolean;
	}

	/* *** User Interface *** */
	interface User {
		id: string;
		email: string | null;
		name: string | null;
	}

	/* Profile stats */
	interface MeStats {
		collectionsOwned: number;
		collectionsSharedWithMe: number;
		exercisesCreated: number;
		totalAttempts: number;
		correctAttempts: number;
		accuracy: number; // 0..1
		currentStreak: number;
		longestStreak: number;
		lastActiveAt: string | null; // ISO timestamp

		// SRS breakdown
		srsNew: number;
		srsLearning: number;
		srsMature: number;
		srsDueForReview: number;
	}

	namespace StyleProps {
		type Color = "primary" | "secondary" | "tertiary" | "success" | "warning" | "error" | "surface";
		type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;
		type Preset = "filled" | "tonal" | "outlined" | "ghost";
		type Size = "sm" | "base" | "lg";
	}

	/* Admin Interfaces */
	namespace Admin {
		type AccessLevel = "VIEW" | "STUDY" | "EDIT";

		interface UserListItem {
			id: string;
			email: string;
			name: string | null;
			role: string;
			isActive: boolean;
			createdAt: string;
		}

		type UserRole = "USER" | "ADMIN" | "MODERATOR";

		interface CreateUserPayload {
			name: string;
			email: string;
			password: string;
			role?: UserRole;
		}

		interface UpdateUserPayload {
			name?: string;
			email?: string;
			role?: UserRole;
			isActive?: boolean;
		}

		interface CollectionGrant {
			userId: string;
			name: string | null;
			email: string;
			accessLevel: AccessLevel;
			grantedAt: string;
			grantedById: string | null;
			grantedByName: string | null;
		}

		interface CollectionAccess {
			collection: { id: string; name: string };
			owner: { id: string; name: string | null; email: string };
			grants: CollectionGrant[];
		}

		interface UserAccess {
			owned: Array<{ id: string; name: string }>;
			shared: Array<{
				collectionId: string;
				name: string;
				ownerId: string;
				ownerName: string | null;
				accessLevel: AccessLevel;
				grantedAt: string;
			}>;
		}
	}
}

export {};
