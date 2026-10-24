<script lang="ts">
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import Unauthorized from "./Unauthorized.svelte";

	let loggingOut = $state(false);

	async function handleLogout(): Promise<void> {
		if (loggingOut) return;
		loggingOut = true;
		try {
			await session.logout();
			router.navigate("/");
		} finally {
			loggingOut = false;
		}
	}
</script>

{#if session.loading}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized />
{:else}
	<div class="mx-auto max-w-md p-8">
		<h1 class="mb-6 text-2xl font-bold">Profile</h1>

		<dl class="mb-6 flex flex-col gap-3">
			<div>
				<dt class="text-sm text-slate-500">ID</dt>
				<dd class="font-mono text-sm">{session.user.id}</dd>
			</div>
			<div>
				<dt class="text-sm text-slate-500">Name</dt>
				<dd>{session.user.name ?? "—"}</dd>
			</div>
			<div>
				<dt class="text-sm text-slate-500">Email</dt>
				<dd>{session.user.email ?? "—"}</dd>
			</div>
		</dl>

		<button type="button" onclick={handleLogout} disabled={loggingOut} class="btn variant-filled-error">
			{loggingOut ? "Signing out…" : "Sign out"}
		</button>
	</div>
{/if}
