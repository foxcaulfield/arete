import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule, {
		bodyParser: false,
	});

	app.enableCors({
		origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
	});

	app.useGlobalPipes(
		new ValidationPipe({
			whitelist: true,
			transform: true,
			forbidNonWhitelisted: true,
			forbidUnknownValues: true,
			// disableErrorMessages: true,
		})
	);

	await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err): void => {
	console.error(err);
	process.exit(1);
});
