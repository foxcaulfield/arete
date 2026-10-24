class SessionStore {
	public user = $state<User | null>(null);
	public loading = $state(true);
	public error = $state<string | null>(null);

	public async load(): Promise<void> {
		this.loading = true;
		this.error = null;
		try {
			this.user = await backend.api.auth.me();
		} catch (e) {
			// 401 during the initial boot (no cookie yet) is expected — not an error
			if (e instanceof ApiError && e.statusCode === 401) {
				this.user = null;
			} else {
				this.error = e instanceof Error ? e.message : String(e);
				this.user = null;
			}
		} finally {
			this.loading = false;
		}
	}

	public async logout(): Promise<void> {
		try {
			await backend.api.auth.signout();
		} finally {
			this.user = null;
		}
	}
}

import { backend } from "$lib/api/client";
import { ApiError } from "$lib/api/errors";

export const session = new SessionStore();
