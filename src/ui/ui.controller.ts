import { Controller, Get, Render } from "@nestjs/common";

@Controller("ui")
export class UiController {
	@Get("/")
	@Render("home.njk")
	public getHome(): { title: string; subtitle: string } {
		return {
			title: "Arete",
			subtitle: "Welcome",
		};
	}

	@Get("/time")
	@Render("partials/time.njk")
	public getTime(): { now: string } {
		return {
			now: new Date().toLocaleString(),
		};
	}
}
