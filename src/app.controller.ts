import { Controller, Get, Redirect, UseGuards } from "@nestjs/common";
import { AppService } from "./app.service";
import { UsersService } from "./users/users.service";
import { UserStatsDto } from "./users/dto/user-stats.dto";
import { RolesGuard } from "./guards/roles.guard";
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth";

type UserToReturn = {
	id: string;
	email: string;
	name: string | null;
};

@Controller()
export class AppController {
	public constructor(
		private readonly appService: AppService,
		private readonly usersService: UsersService
	) {}

	@Get()
	@AllowAnonymous()
	@Redirect("/app", 302)
	public redirect(): void {}

	@Get("health")
	@AllowAnonymous()
	public getHello(): string {
		return this.appService.getHello();
	}

	@Get("me")
	@UseGuards(RolesGuard)
	public me(@Session() session: UserSession): UserToReturn {
		return {
			id: session.user.id,
			email: session.user.email,
			name: session.user.name,
		};
	}

	@Get("me/stats")
	@UseGuards(RolesGuard)
	public getMyStats(@Session() session: UserSession): Promise<UserStatsDto> {
		return this.usersService.getStats(session.user.id);
	}
}
