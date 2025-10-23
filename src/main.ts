import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "./configs/joi-env.config";

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule, {
		bodyParser: false,
	});

	const configService = app.get<ConfigService<EnvConfig, true>>(ConfigService);
	console.log("App running in", configService.get<string>("NODE_ENV"), "mode");

	app.enableCors({
		origin: configService.get("CORS_ORIGINS", { infer: true }).split(","),
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

	await app.listen(configService.get("APPLICATION_PORT", { infer: true }));
}
bootstrap().catch((err): void => {
	console.error(err);
	process.exit(1);
});
