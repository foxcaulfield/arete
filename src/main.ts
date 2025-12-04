/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import { EnvConfig } from "./configs/joi-env.config";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import { ValidationError } from "class-validator";
import nunjucks from "nunjucks";
import { join } from "path";
import { NestExpressApplication } from "@nestjs/platform-express";
import { marked } from "marked";

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create<NestExpressApplication>(AppModule, {
		bodyParser: false,
	});

	const configService = app.get<ConfigService<EnvConfig, true>>(ConfigService);
	const appMode = configService.get("NODE_ENV", { infer: true });
	const isProduction = appMode === "production";
	console.log("App running in", appMode, "mode");

	const viewsDir = join(process.cwd(), "views");
	const staticDir = join(process.cwd(), "public");

	app.useStaticAssets(staticDir);
	app.setBaseViewsDir(viewsDir);
	const expressInstance = app.getHttpAdapter().getInstance();
	nunjucks
		.configure(viewsDir, {
			express: expressInstance,
			autoescape: true,
			noCache: !isProduction,
			watch: !isProduction,
		})
		.addFilter("parseQuestion", function (question: string) {
			if (!question) return [];

			const result = [];
			const regEx = /{{(.*?)}}|([^{}]+)/g;
			let match;

			while ((match = regEx.exec(question)) !== null) {
				if (match[1]) {
					result.push({ text: match[1].trim(), isAnswer: true });
				} else if (match[2]) {
					result.push({ text: match[2].trim(), isAnswer: false });
				}
			}
			return result;
		})
		.addFilter("filterMarkdown", function (text: string) {
			return marked.parse(text);
		})
		.addGlobal("uuid", function (length: number) {
			const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
			let result = "";
			for (let i = 0; i < length; i++) {
				result += chars.charAt(Math.floor(Math.random() * chars.length));
			}
			return result;
		})
		.addGlobal("IMAGE_ENDPOINT", "/exercises/files/image")
		.addGlobal("AUDIO_ENDPOINT", "/exercises/files/audio")
		.addGlobal("EXERCISES_UI_ENDPOINT", "/ui/exercises")
		.addGlobal("COLLECTIONS_UI_ENDPOINT", "/ui/collections");

	app.setViewEngine("njk");

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
