export class ApiError extends Error {
	public constructor(
		public statusCode: number,
		public error: string,
		message: string,
		public fields?: Record<string, string[]>
	) {
		super(message);
		this.name = "ApiError";
	}
}

export class ValidationError extends ApiError {
	public constructor(
		public fields: Record<string, string[]>,
		message = "Validation failed"
	) {
		super(400, "Validation Error", message, fields);
		this.name = "ValidationError";
	}

	public getAllErrors(): string[] {
		return Object.values(this.fields).flat();
	}

	public getFieldError(field: string): string | undefined {
		return this.fields[field]?.[0];
	}

	public hasFieldError(field: string): boolean {
		return !!this.fields[field]?.length;
	}
}
