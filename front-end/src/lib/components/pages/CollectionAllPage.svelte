<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import Unauthorized from "./Unauthorized.svelte";
	import Forbidden from "./Forbidden.svelte";
	import CollectionsTable from "$lib/components/collections/CollectionsTable.svelte";

	let collections = $state<Collection.ResponseDto[]>([]);
	let loading = $state(true);
	let pageStatus = $state<number | null>(null);

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			loading = false;
			return;
		}
		void (async () => {
			loading = true;
			pageStatus = null;
			try {
				const res = await backend.api.collections.all();
				collections = res.data;
			} catch (e) {
				pageStatus = interpretActionError(e).status;
			} finally {
				loading = false;
			}
		})();
	});
</script>

{#if session.loading || loading}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized />
{:else if pageStatus === 403}
	<Forbidden />
{:else if pageStatus !== null}
	<div class="p-8 text-red-600">Error {pageStatus}</div>
{:else}
	<div class="space-y-4 p-4">
		<div class="flex items-center justify-between">
			<h1 class="h3">All collections</h1>
			<Button
				text="Back to Your Collections"
				type="button"
				preset="outlined"
				color="primary"
				size="sm"
				onclick={() => router.navigate("/collections")}
			/>
		</div>

		{#if collections.length === 0}
			<div class="py-12 text-center opacity-50">No collections found.</div>
		{:else}
			<div class="overflow-x-auto">
				<CollectionsTable {collections} />
			</div>
		{/if}
	</div>
{/if}
