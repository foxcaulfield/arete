import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule, {
		bodyParser: false,
	});

	app.enableCors({
		origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : ["http://localhost:5173"],
		credentials: true, // CRITICAL: allows cookies
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization"],
		exposedHeaders: ["Content-Type", "Authorization"],
		maxAge: 3600, // Preflight cache
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
