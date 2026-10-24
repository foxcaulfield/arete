<script lang="ts">
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import CollectionForm from "$lib/components/collections/CollectionForm.svelte";
	import Unauthorized from "./Unauthorized.svelte";
	import Forbidden from "./Forbidden.svelte";
	import NotFound from "./NotFound.svelte";

	let { slug }: { slug: string } = $props();

	let collection = $state<Collection.ResponseDto | null>(null);
	let loading = $state(true);
	let pageStatus = $state<number | null>(null);
	let generalError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string[]>>({});

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			loading = false;
			return;
		}
		const s = slug;
		void s;
		void (async () => {
			loading = true;
			pageStatus = null;
			try {
				collection = await backend.api.collections.getById(s);
			} catch (e) {
				pageStatus = interpretActionError(e).status;
			} finally {
				loading = false;
			}
		})();
	});

	async function handleSave(values: { name: string; description: string }): Promise<void> {
		if (!collection) return;
		generalError = null;
		fieldErrors = {};
		try {
			await backend.api.collections.update(collection.id, {
				name: values.name,
				description: values.description || undefined,
			});
			router.navigate(`/collections/view/${collection.id}?updated=1`);
		} catch (e) {
			const err = interpretActionError(e);
			generalError = err.message;
			fieldErrors = err.fields ?? {};
		}
	}
</script>

{#if session.loading || loading}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized message="You need to sign in to edit this collection." />
{:else if pageStatus === 404}
	<NotFound />
{:else if pageStatus === 403}
	<Forbidden />
{:else if pageStatus !== null}
	<div class="p-8 text-red-600">Error {pageStatus}</div>
{:else if collection}
	{@const c = collection}

	<CollectionForm
		mode="edit"
		initialValues={{ name: collection.name, description: collection.description }}
		onSave={handleSave}
		onCancel={() => router.navigate(`/collections/view/${c.id}`)}
		{generalError}
		{fieldErrors}
	/>
{/if}
