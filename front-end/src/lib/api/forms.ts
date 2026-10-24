import { ApiError, ValidationError } from "./errors";

export function validateParams(params: Record<string, string | undefined>, required: string[]): string | null {
	for (const param of required) {
		if (!params[param]) return `Missing required parameter: ${param}`;
	}
	return null;
}

// Replaces Backend.extractApiErrorFlags — same shape, no SvelteKit dependency.
export interface ApiErrorFlags {
	unauthorized?: boolean;
	forbidden?: boolean;
	notFound?: boolean;
	unknownError?: boolean;
	errorText: string;
}

export function extractApiErrorFlags(e: unknown): ApiErrorFlags {
	if (e instanceof ApiError) {
		if (e.statusCode === 401) return { unauthorized: true, errorText: e.message };
		if (e.statusCode === 403) return { forbidden: true, errorText: e.message };
		if (e.statusCode === 404) return { notFound: true, errorText: e.message };
	}
	return { unknownError: true, errorText: e instanceof Error ? e.message : String(e) };
}

// Replaces handleActionError. Instead of `fail()` (SvelteKit-only),
// return a plain state object the component decides what to do with.
export interface ActionErrorState {
	status: number;
	message: string;
	fields?: Record<string, string[]>;
	unauthorized?: boolean;
	forbidden?: boolean;
}

export function interpretActionError(e: unknown): ActionErrorState {
	if (e instanceof ValidationError) {
		return { status: 400, message: e.message, fields: e.fields };
	}
	if (e instanceof ApiError) {
		return {
			status: e.statusCode,
			message: e.message,
			fields: e.fields,
			unauthorized: e.statusCode === 401,
			forbidden: e.statusCode === 403,
		};
	}
	return { status: 500, message: e instanceof Error ? e.message : String(e) };
}
