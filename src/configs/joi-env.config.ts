import Joi from "joi";

export type EnvConfig = {
	NODE_ENV: "development" | "production";
	DATABASE_PORT: number;

	// Direct DATABASE_URL for local development
	// 'db' is the service name in docker-compose,
	// so use 'localhost' for local development outside Docker
	DATABASE_URL: string;
	APPLICATION_PORT: number;

	// API URL (for Better Auth baseURL)
	// API_URL: string;
	// Better Auth configuration
	BETTER_AUTH_SECRET: string;
	COOKIE_PREFIX: string;

	// CORS - Comma-separated list of allowed origins
	CORS_ORIGINS: string;

	// Better Auth Trusted Origins - Comma-separated list
	TRUSTED_ORIGINS: string;

	CONTAINER_FILE_STORAGE_PATH: string;
	HOST_MACHINE_FILE_STORAGE_PATH: string;
	MAX_PAYLOAD_SIZE: number;
};

export const envValidationSchema = Joi.object<EnvConfig, true>({
	NODE_ENV: Joi.string().valid("development", "production").required(),
	DATABASE_PORT: Joi.number().required(),
	DATABASE_URL: Joi.string().uri().required(),
	APPLICATION_PORT: Joi.number().required(),
	// API_URL: Joi.string().uri().required(),
	BETTER_AUTH_SECRET: Joi.string().min(8).required(),
	COOKIE_PREFIX: Joi.string().required(),
	CORS_ORIGINS: Joi.string().not().required().allow(""),
	TRUSTED_ORIGINS: Joi.string().required(),
	CONTAINER_FILE_STORAGE_PATH: Joi.string().required(),
	HOST_MACHINE_FILE_STORAGE_PATH: Joi.string().required(),
	MAX_PAYLOAD_SIZE: Joi.number().required(),
});
