import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";

describe("AuthController", (): void => {
	let controller: AuthController;

	beforeEach(async (): Promise<void> => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{
					provide: "AuthService",
					useValue: {
						// mock methods as needed
						login: jest.fn(),
						register: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<AuthController>(AuthController);
	});

	it("should be defined", (): void => {
		expect(controller).toBeDefined();
	});
});
