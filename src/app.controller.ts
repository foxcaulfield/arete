import { Controller, Get } from "@nestjs/common";
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

	@Get("me")
	public me(@Session() session: UserSession): UserToReturn {
		return {
			id: session.user.id,
			email: session.user.email,
			name: session.user.name,
		};
	}
}
