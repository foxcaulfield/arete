import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { Public } from "./auth/decorators/with-roles.decorator";
@Controller()
export class AppController {
	public constructor(private readonly appService: AppService) {}

	@Public()
	@Get()
	public getHello(): string {
		return this.appService.getHello();
	}
}
