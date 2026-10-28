import { ApiError, ValidationError } from "./errors";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

class BackendClient {
	private readonly baseHeaders: Record<string, string> = {
		"Content-Type": "application/json",
	};

	private async request(method: HttpMethod, endpoint: string, body?: unknown): Promise<Response> {
		const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
		const headers = { ...this.baseHeaders };
		if (isFormData) delete headers["Content-Type"];

		const res = await fetch(endpoint, {
			method,
			credentials: "include",
			headers,
			body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
		});

		if (!res.ok) await this.handleErrorResponse(res);
		return res;
	}

	private async handleErrorResponse(res: Response): Promise<never> {
		let errorData: {
			statusCode?: number;
			error?: string;
			message?: string;
			fields?: Record<string, string[]>;
		};

		try {
			errorData = await res.json();
		} catch {
			throw new ApiError(res.status, res.statusText, `Request failed with status ${res.status}`);
		}

		if (res.status === 400 && errorData.fields) {
			throw new ValidationError(errorData.fields, errorData.message);
		}

		throw new ApiError(
			errorData.statusCode || res.status,
			errorData.error || res.statusText,
			errorData.message || `Request failed with status ${res.status}`,
			errorData.fields
		);
	}

	public api = {
		auth: {
			me: async (): Promise<User> => {
				const r = await this.request("GET", "/me");
				return (await r.json()) as User;
			},
			meStats: async (): Promise<MeStats> => {
				const r = await this.request("GET", "/me/stats");
				return (await r.json()) as MeStats;
			},
			signup: (data: { name?: string; email?: string; password?: string }): Promise<Response> =>
				this.request("POST", "/api/auth/sign-up/email", data),
			signin: (data: { email?: string; password?: string }): Promise<Response> =>
				this.request("POST", "/api/auth/sign-in/email", data),
			signout: (): Promise<Response> => this.request("POST", "/api/auth/sign-out", {}),
		},
		collections: {
			list: async (
				page = 1,
				limit = 10,
				filters?: {
					search?: string;
					sortBy?: "name" | "createdAt" | "updatedAt";
					sortOrder?: "asc" | "desc";
				}
			): Promise<PaginatedResponse<Collection.ResponseDto>> => {
				const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
				if (filters?.search) qs.set("search", filters.search);
				if (filters?.sortBy) qs.set("sortBy", filters.sortBy);
				if (filters?.sortOrder) qs.set("sortOrder", filters.sortOrder);
				const r = await this.request("GET", `/collections/list?${qs.toString()}`);
				return (await r.json()) as PaginatedResponse<Collection.ResponseDto>;
			},
			all: async (page = 1, limit = 10): Promise<PaginatedResponse<Collection.ResponseDto>> => {
				const r = await this.request("GET", `/collections/all?page=${page}&limit=${limit}`);
				return (await r.json()) as PaginatedResponse<Collection.ResponseDto>;
			},
			shared: async (
				page = 1,
				limit = 10,
				search?: string
			): Promise<PaginatedResponse<Collection.ResponseDto>> => {
				const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
				if (search) qs.set("search", search);
				const r = await this.request("GET", `/collections/shared?${qs.toString()}`);
				return (await r.json()) as PaginatedResponse<Collection.ResponseDto>;
			},
			create: async (name: string, description?: string): Promise<Collection.ResponseDto> => {
				const r = await this.request("POST", "/collections/create", { name, description });
				return (await r.json()) as Collection.ResponseDto;
			},
			getById: async (id: string): Promise<Collection.ResponseDto> => {
				const r = await this.request("GET", `/collections/get_by_id/${id}`);
				return (await r.json()) as Collection.ResponseDto;
			},
			update: async (id: string, data: Collection.UpdateDto): Promise<Collection.ResponseDto> => {
				const r = await this.request("PATCH", `/collections/update/${id}`, data);
				return (await r.json()) as Collection.ResponseDto;
			},
			delete: async (id: string): Promise<{ success: boolean }> => {
				const r = await this.request("DELETE", `/collections/delete/${id}`);
				return (await r.json()) as { success: boolean };
			},
		},
		exercises: {
			getById: async (id: string): Promise<Exercise.ResponseDto> => {
				const r = await this.request("GET", `/exercises/get_by_id/${id}`);
				return (await r.json()) as Exercise.ResponseDto;
			},
			create: async (payload: FormData): Promise<Exercise.ResponseDto> => {
				const r = await this.request("POST", "/exercises/create", payload);
				return (await r.json()) as Exercise.ResponseDto;
			},
			update: async (id: string, payload: FormData): Promise<Exercise.ResponseDto> => {
				const r = await this.request("PATCH", `/exercises/update/${id}`, payload);
				return (await r.json()) as Exercise.ResponseDto;
			},
			delete: async (id: string): Promise<Exercise.ResponseDto> => {
				const r = await this.request("DELETE", `/exercises/delete/${id}`);
				return (await r.json()) as Exercise.ResponseDto;
			},
			getDrillQuestion: async (collectionId: string): Promise<Quiz.QuestionDto> => {
				const r = await this.request("GET", `/exercises/drill/${collectionId}`);
				return (await r.json()) as Quiz.QuestionDto;
			},
			submitDrillAnswer: async (
				collectionId: string,
				exerciseId: string,
				userAnswer: string
			): Promise<Quiz.UserAnswerFeedbackDto> => {
				const r = await this.request("POST", `/exercises/drill/${collectionId}/submit`, {
					exerciseId,
					userAnswer,
				});
				return (await r.json()) as Quiz.UserAnswerFeedbackDto;
			},
			getDrillStats: async (collectionId: string): Promise<Quiz.CollectionStatsDto> => {
				const r = await this.request("GET", `/exercises/drill/${collectionId}/stats`);
				return (await r.json()) as Quiz.CollectionStatsDto;
			},
			getListByCollectionId: async (
				collectionId: string,
				page = 1,
				limit = 20,
				filters?: {
					search?: string;
					type?: "FILL_IN_THE_BLANK" | "CHOICE_SINGLE";
					hasImage?: "has" | "none";
					hasAudio?: "has" | "none";
					sortBy?: "question" | "createdAt" | "updatedAt" | "totalAttempts" | "mostFailed";
					sortOrder?: "asc" | "desc";
				}
			): Promise<PaginatedResponse<Exercise.ResponseDto>> => {
				const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
				if (filters?.search) qs.set("search", filters.search);
				if (filters?.type) qs.set("type", filters.type);
				if (filters?.hasImage) qs.set("hasImage", filters.hasImage);
				if (filters?.hasAudio) qs.set("hasAudio", filters.hasAudio);
				if (filters?.sortBy) qs.set("sortBy", filters.sortBy);
				if (filters?.sortOrder) qs.set("sortOrder", filters.sortOrder);
				const r = await this.request("GET", `/exercises/by_collection/${collectionId}?${qs.toString()}`);
				return (await r.json()) as PaginatedResponse<Exercise.ResponseDto>;
			},
			getFile: (fileType: string, filename: string): Promise<Response> =>
				this.request("GET", `/exercises/files/${encodeURIComponent(fileType)}/${encodeURIComponent(filename)}`),
		},
		admin: {
			users: {
				list: async (page = 1, limit = 20, search?: string): Promise<PaginatedResponse<Admin.UserListItem>> => {
					const qs = new URLSearchParams({
						page: String(page),
						limit: String(limit),
						...(search ? { search } : {}),
					});
					const r = await this.request("GET", `/admin/users?${qs.toString()}`);
					return (await r.json()) as PaginatedResponse<Admin.UserListItem>;
				},
				access: async (userId: string): Promise<Admin.UserAccess> => {
					const r = await this.request("GET", `/admin/users/${userId}/access`);
					return (await r.json()) as Admin.UserAccess;
				},
			},
			collections: {
				access: {
					list: async (collectionId: string): Promise<Admin.CollectionAccess> => {
						const r = await this.request("GET", `/admin/collections/${collectionId}/access`);
						return (await r.json()) as Admin.CollectionAccess;
					},
					grant: async (
						collectionId: string,
						userId: string,
						accessLevel: Admin.AccessLevel
					): Promise<Admin.CollectionGrant> => {
						const r = await this.request("POST", `/admin/collections/${collectionId}/access`, {
							userId,
							accessLevel,
						});
						return (await r.json()) as Admin.CollectionGrant;
					},
					revoke: async (collectionId: string, userId: string): Promise<{ success: true }> => {
						const r = await this.request("DELETE", `/admin/collections/${collectionId}/access/${userId}`);
						return (await r.json()) as { success: true };
					},
				},
			},
		},
	};
}

export const backend = new BackendClient();
