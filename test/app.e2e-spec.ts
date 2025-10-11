import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "./../src/app.module";
import { App } from "supertest/types";

describe("AppController (e2e)", (): void => {
	let app: INestApplication<App>;

	beforeAll(async (): Promise<void> => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	it("/ (GET)", async (): Promise<void> => {
		const httpServer = app.getHttpServer();
		await request(httpServer).get("/").expect(200).expect("Hello World!");
	});

	afterAll(async (): Promise<void> => {
		await app.close();
	});
});
