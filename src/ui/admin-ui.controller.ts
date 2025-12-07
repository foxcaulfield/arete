import { Controller, Get, Param, Query, Render } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { Roles } from "src/decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { AdminUiService } from "./admin-ui.service";

@Controller("ui/admin")
@Roles(UserRole.ADMIN)
export class AdminUiController {
public constructor(
private readonly adminUiService: AdminUiService
) {}

/* Admin routes */
@Get()
@Render("admin/dashboard.njk")
public async adminDashboard(@Session() session: UserSession): Promise<object> {
return this.adminUiService.getAdminDashboard(session);
}

@Get("collections")
@Render("admin/collections.njk")
public async adminCollections(
@Session() session: UserSession,
@Query("page") page: string = "1",
@Query("limit") limit: string = "20",
@Query("search") search?: string
): Promise<object> {
return this.adminUiService.getAdminCollections(session, page, limit, search);
}

@Get("users")
@Render("admin/users.njk")
public async adminUsers(
@Session() session: UserSession,
@Query("page") page: string = "1",
@Query("limit") limit: string = "20",
@Query("search") search?: string
): Promise<object> {
return this.adminUiService.getAdminUsers(session, page, limit, search);
}

	@Get("users/create")
	@Render("admin/user-create.njk")
	public async adminUserCreate(@Session() _session: UserSession): Promise<object> {
		return this.adminUiService.getAdminUserCreate();
	}	@Get("users/:id")
	@Render("admin/user-detail.njk")
	public async adminUserDetail(
		@Session() _session: UserSession,
		@Param("id") userId: string
	): Promise<object> {
		return this.adminUiService.getAdminUserDetail(userId);
	}	@Get("users/:id/edit")
	@Render("admin/user-edit.njk")
	public async adminUserEdit(
		@Session() _session: UserSession,
		@Param("id") userId: string
	): Promise<object> {
		return this.adminUiService.getAdminUserEdit(userId);
	}	@Get("exercises")
	@Render("admin/exercises.njk")
	public async adminExercises(
		@Session() _session: UserSession,
		@Query("page") page: string = "1",
		@Query("limit") limit: string = "30",
		@Query("search") search?: string,
		@Query("filter") filter?: string
	): Promise<object> {
		return this.adminUiService.getAdminExercises(page, limit, search, filter);
	}	@Get("attempts")
	@Render("admin/attempts.njk")
	public async adminAttempts(
		@Session() _session: UserSession,
		@Query("page") page: string = "1",
		@Query("limit") limit: string = "30",
		@Query("search") search?: string,
		@Query("result") result?: string,
		@Query("filter") filter?: string
	): Promise<object> {
		return this.adminUiService.getAdminAttempts(page, limit, search, result, filter);
	}
}