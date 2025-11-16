import { Controller, Get, Render } from "@nestjs/common";
import { AppService } from "./app.service";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";

type UserToReturn = {
	id: string;
	email: string;
	name: string | null;
};

@Controller()
export class AppController {
	public constructor(private readonly appService: AppService) {}

	@Get()
	public getHello(): string {
		return this.appService.getHello();
	}

	// Minimal SSR home page (Nunjucks)
	@Get("ui")
	@Render("home.njk")
	public home(): Record<string, unknown> {
		return { title: "Arete", subtitle: "Welcome to the server-rendered UI" };
	}

	// Small htmx demo endpoint returning a fragment with current server time
	@Get("ui/time")
	@Render("partials/time.njk")
	public time(): Record<string, string> {
		return { now: new Date().toLocaleString() };
	}

	@Get("me")
	public me(@Session() session: UserSession): UserToReturn {
		return {
			id: session.user.id,
			email: session.user.email,
			name: session.user.name,
		};
	}
}
