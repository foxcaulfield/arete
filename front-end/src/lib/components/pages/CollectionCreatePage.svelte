<script lang="ts">
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import CollectionForm from "$lib/components/collections/CollectionForm.svelte";
	import Unauthorized from "./Unauthorized.svelte";

	let generalError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string[]>>({});

	async function handleSave(values: { name: string; description: string }): Promise<void> {
		generalError = null;
		fieldErrors = {};
		try {
			const created = await backend.api.collections.create(values.name, values.description || undefined);
			router.navigate(`/collections/view/${created.id}?created=1`);
		} catch (e) {
			const err = interpretActionError(e);
			generalError = err.message;
			fieldErrors = err.fields ?? {};
		}
	}
</script>

{#if session.loading}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized message="You need to sign in to create a collection." />
{:else}
	<CollectionForm
		mode="create"
		onSave={handleSave}
		onCancel={() => router.navigate("/collections")}
		{generalError}
		{fieldErrors}
	/>
{/if}
