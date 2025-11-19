import { Controller, Get, Param, Query, Render } from "@nestjs/common";
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { CollectionsService } from "src/collections/collections.service";
import { ExercisesService } from "src/exercises/exercises.service";
import { ResponseCollectionDto } from "src/collections/dto/response-collection.dto";
// import { type Response } from "express";
import { PaginatedResponseDto } from "src/common/types";
import { ResponseExerciseDto } from "src/exercises/dto/response-exercise.dto";
import { FilterExerciseDto } from "src/exercises/dto/filter-exercise.dto";

type Paginated<T> = PaginatedResponseDto<T>;

@Controller("ui")
export class UiController {
	public constructor(
		private readonly collectionsService: CollectionsService,
		private readonly exercisesService: ExercisesService
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
	public dashboard(): { title: string } {
		return { title: "dashboard" };
	}

	@Get("/profile")
	@Render("profile.njk")
	public profile(@Session() session: UserSession): { name: string; email: string } {
		return {
			name: session.user.name,
			email: session.user.email,
		};
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
	public collections(
		@Session() session: UserSession,
		@Query("page") page?: string,
		@Query("limit") limit?: string
	): Promise<Paginated<ResponseCollectionDto>> {
		return this.collectionsService.getCollectionsByUserId(
			session.user.id,
			page ? parseInt(page) : 1,
			limit ? parseInt(limit) : 10
		);
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
	}> {
		const [collection, exercises] = await Promise.all([
			this.collectionsService.getCollectionById(id, session.user.id),
			this.exercisesService.getExercisesInCollection(session.user.id, id, filter),
		]);

		return { collection, exercises };
	}

	/* exercises */
	@Get("/exercises/create")
	@Render("exercises/create-form.njk")
	public createExercise(@Query("collectionId") collectionId?: string): object {
		return { collectionId };
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
}
