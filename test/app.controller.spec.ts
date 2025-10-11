import { Test, TestingModule } from "@nestjs/testing";
import { AppController } from "../src/app.controller";
import { AppService } from "../src/app.service";

describe("AppController", (): void => {
	let appController: AppController;

	beforeEach(async (): Promise<void> => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AppController],
			providers: [AppService],
		}).compile();

		appController = module.get<AppController>(AppController);
	});

	it('should return "Hello World!"', (): void => {
		expect(appController.getHello()).toBe("Hello World!");
	});
});
