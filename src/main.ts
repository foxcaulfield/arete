import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule);

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
