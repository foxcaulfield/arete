import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";

describe("AuthService", (): void => {
	let service: AuthService;

	beforeEach(async (): Promise<void> => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: "UsersService", useValue: {} },
				{ provide: "JwtService", useValue: {} },
				{ provide: "PrismaService", useValue: {} },
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
	});

	it("should be defined", (): void => {
		expect(service).toBeDefined();
	});
});
