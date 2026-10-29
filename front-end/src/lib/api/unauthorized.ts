// Global "session is dead" signal. Fired by BackendClient on any 401.
// Listeners clear the reactive session store so the UI re-renders with
// <Unauthorized /> without waiting for the next session.load() call.
//
// Lives in its own module to avoid a circular import between
// api/client.ts and auth/session.svelte.ts.

export const unauthorizedEvents = new EventTarget();

export function emitUnauthorized(): void {
	unauthorizedEvents.dispatchEvent(new Event("unauthorized"));
}
