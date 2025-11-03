/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "./configs/joi-env.config";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import { ValidationError } from "class-validator";

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule, {
		bodyParser: false,
	});

	const configService = app.get<ConfigService<EnvConfig, true>>(ConfigService);
	const appMode = configService.get("NODE_ENV", { infer: true });
	const isProduction = appMode === "production";
	console.log("App running in", appMode, "mode");

	app.enableCors({
		origin: isProduction ? configService.get("CORS_ORIGINS", { infer: true }).split(",") : "*",
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
			exceptionFactory: (errors: ValidationError[]) => {
				const formattedErrors = errors.reduce(
					(acc, error) => {
						const constraints = error.constraints;
						if (constraints) {
							acc[error.property] = Object.values(constraints);
						}
						return acc;
					},
					{} as Record<string, string[]>
				);

				return new BadRequestException({
					statusCode: 400,
					error: "Bad Request",
					message: "Validation failed",
					fields: formattedErrors,
				});
			},
		})
	);

	await app.listen(configService.get("APPLICATION_PORT", { infer: true }));
}
bootstrap().catch((err): void => {
	console.error(err);
	process.exit(1);
});
