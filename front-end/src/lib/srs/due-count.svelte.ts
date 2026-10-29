import { backend } from "$lib/api/client";

class DueCountStore {
	public value = $state(0);
	public loading = $state(false);
	private inFlight: Promise<void> | null = null;

	/** Refetch; concurrent calls dedup to a single request. */
	public async refresh(): Promise<void> {
		if (this.inFlight) return this.inFlight;
		this.loading = true;
		this.inFlight = (async () => {
			try {
				const res = await backend.api.exercises.getGlobalDueCount();
				this.value = res.count;
			} catch {
				// Keep previous value on transient network blips — do not zero the badge
			} finally {
				this.loading = false;
				this.inFlight = null;
			}
		})();
		return this.inFlight;
	}

	public reset(): void {
		this.value = 0;
	}
}

export const dueCount = new DueCountStore();
