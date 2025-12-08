import { Controller, Get, Param, Query, Render } from "@nestjs/common";
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { CollectionsService } from "src/collections/collections.service";
import { ExercisesService } from "src/exercises/exercises.service";
import { ResponseCollectionDto } from "src/collections/dto/response-collection.dto";
// import { type Response } from "express";
import { PaginatedResponseDto } from "src/common/types";
import { ResponseExerciseDto } from "src/exercises/dto/response-exercise.dto";
import { FilterExerciseDto } from "src/exercises/dto/filter-exercise.dto";
import { FilterCollectionDto } from "src/collections/dto/filter-collection.dto";
import { QuizService } from "src/exercises/quiz.service";
import { QuizQuestionDto } from "src/exercises/dto/quiz.dto";
import { UiService } from "./ui.service";

import { DashboardStats } from "./dashboard-stats.interface";

type Paginated<T> = PaginatedResponseDto<T>;

@Controller("ui")
export class UiController {
	public constructor(
		private readonly collectionsService: CollectionsService,
		private readonly exercisesService: ExercisesService,
		private readonly quizService: QuizService,
		private readonly uiService: UiService
	) {}

	@Get("/")
	@AllowAnonymous()
	@Render("home.njk")
	public getHome(): { title: string; subtitle: string } {
		return {
			title: "Arete",
			subtitle: "Welcome",
		};
	}

	@Get("/time")
	@AllowAnonymous()
	@Render("partials/time.njk")
	public getTime(): { now: string } {
		return {
			now: new Date().toLocaleString(),
		};
	}

	@Get("/auth/login")
	@AllowAnonymous()
	@Render("auth/login.njk")
	public getLoginPage(): object {
		return {};
	}

	@Get("/auth/signup")
	@AllowAnonymous()
	@Render("auth/signup.njk")
	public getSignUpPage(): object {
		return {};
	}

	@Get("/dashboard")
	@Render("dashboard.njk")
	public async dashboard(
		@Session() session: UserSession,
		@Query("view") view?: string
	): Promise<{
		title: string;
		stats: DashboardStats;
		randomCollectionId: string | null;
		isAdmin: boolean;
		viewMode: string;
	}> {
		return this.uiService.getDashboard(session, view);
	}

	@Get("/profile")
	@Render("profile.njk")
	public async profile(@Session() session: UserSession): Promise<object> {
		return this.uiService.getProfile(session);
	}

	/* collection */
	@Get("/collections/create")
	@Render("collections/create-form.njk")
	public createCollection(): object {
		return {};
	}

	@Get("/collections/:id/edit")
	@Render("collections/edit-form.njk")
	public async editCollection(
		@Param("id") collectionId: string,
		@Session() session: UserSession
	): Promise<{ collection: ResponseCollectionDto }> {
		const collection = await this.collectionsService.getCollectionById(collectionId, session.user.id);
		return { collection };
	}

	@Get("/collections")
	@Render("collections/page.njk")
	public async collections(
		@Session() session: UserSession,
		@Query() filter: FilterCollectionDto
	): Promise<Paginated<ResponseCollectionDto> & { filter: FilterCollectionDto }> {
		const result = await this.collectionsService.getCollectionsByUserId(session.user.id, filter);
		return { ...result, filter };
	}

	@Get("/collections/:id")
	@Render("collections/details.njk")
	public async collectionDetail(
		@Param("id") id: string,
		@Query() filter: FilterExerciseDto,
		@Session() session: UserSession
	): Promise<{
		collection: ResponseCollectionDto;
		exercises: PaginatedResponseDto<ResponseExerciseDto>;
		filter: FilterExerciseDto;
	}> {
		const [collection, exercises] = await Promise.all([
			this.collectionsService.getCollectionById(id, session.user.id),
			this.exercisesService.getExercisesInCollection(session.user.id, id, filter),
		]);

		return { collection, exercises, filter };
	}

	/* exercises */
	@Get("/exercises/create")
	@Render("exercises/create-form.njk")
	public createExercise(@Query("collectionId") collectionId?: string): object {
		return { collectionId };
	}

	@Get("/exercises/:id/edit")
	@Render("exercises/edit-form.njk")
	public async editExercise(
		@Param("id") exerciseId: string,
		@Session() session: UserSession
	): Promise<{ exercise: ResponseExerciseDto }> {
		const exercise = await this.exercisesService.getExerciseById(session.user.id, exerciseId);
		return { exercise };
	}

	@Get("/exercises/:id")
	@Render("exercises/details.njk")
	public async exerciseDetail(
		@Param("id") exerciseId: string,
		@Session() session: UserSession
	): Promise<{ exercise: ResponseExerciseDto }> {
		const exercise = await this.exercisesService.getExerciseById(session.user.id, exerciseId);
		return { exercise };
	}

	@Get("/quiz/:collectionId")
	@Render("quiz/page.njk")
	public async startQuiz(
		@Param("collectionId") collectionId: string,
		@Session() session: UserSession
	): Promise<{
		quizQuestion: QuizQuestionDto;
		collectionId: string;
		collectionName: string;
		sessionStats: { correct: number; total: number; streak: number; maxStreak: number };
		distractorsHotKeyMapFunction: (index: number) => number;
	}> {
		const [quizQuestion, collection, sessionStats] = await Promise.all([
			this.quizService.getDrillExercise(session.user.id, collectionId),
			this.collectionsService.getCollectionById(collectionId, session.user.id),
			Promise.resolve(this.quizService.getSessionStats(session.user.id, collectionId)),
		]);
		return {
			quizQuestion,
			collectionId,
			collectionName: collection.name,
			sessionStats,
			distractorsHotKeyMapFunction: this.distractorsHotKeyMapFunction.bind(this),
		};
	}

	public distractorsHotKeyMapFunction(index: number): number {
		if (index === 1)
			return 5; // Key '5'
		else if (index === 2)
			return 6; // Key '6'
		else if (index === 3)
			return 2; // Key '2'
		else if (index === 4)
			return 3; // Key '3'
		else return index + 100; // Disable hotkey for other buttons
	}
}
