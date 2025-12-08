export type AppLimitsConfig = {
	// User role limits
	USER_MAX_COLLECTIONS: number;
	USER_MAX_EXERCISES_PER_COLLECTION: number;

	// File upload limits (in bytes)
	MAX_AUDIO_FILE_SIZE: number;
	MAX_IMAGE_FILE_SIZE: number;

	// Registration limits
	MAX_REGISTERED_USERS: number;
};

export const APP_LIMITS_SYMBOL = Symbol("APP_LIMITS_CONFIG_KEY");

export const defaultAppLimits: AppLimitsConfig = {
	USER_MAX_COLLECTIONS: 5,
	USER_MAX_EXERCISES_PER_COLLECTION: 20,
	MAX_AUDIO_FILE_SIZE: 1 * 1024 * 1024, // 1 MB
	MAX_IMAGE_FILE_SIZE: 1 * 1024 * 1024, // 1 MB
	MAX_REGISTERED_USERS: 100,
};
