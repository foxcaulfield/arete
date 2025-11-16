import { Controller, Get, Render } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";

@Controller("ui")
export class UiController {
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
}
