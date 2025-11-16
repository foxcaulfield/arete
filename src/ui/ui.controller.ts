import { Controller, Get, Render } from "@nestjs/common";
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth";
// import { type Response } from "express";

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
}
