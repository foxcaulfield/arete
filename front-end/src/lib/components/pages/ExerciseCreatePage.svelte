<script lang="ts">
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import ExerciseEditForm from "$lib/components/exercises/ExerciseEditForm.svelte";
	import Unauthorized from "./Unauthorized.svelte";
	import Forbidden from "./Forbidden.svelte";
	import NotFound from "./NotFound.svelte";

	let { slug }: { slug: string } = $props();

	let collection = $state<Collection.ResponseDto | null>(null);
	let loading = $state(true);
	let pageStatus = $state<number | null>(null);
	let generalError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string[]>>({});

	const canEdit = $derived(
		collection?.myAccessLevel === "OWNER" ||
			collection?.myAccessLevel === "ADMIN" ||
			collection?.myAccessLevel === "EDIT"
	);

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			loading = false;
			return;
		}
		const collId = slug;
		void collId;
		void (async () => {
			loading = true;
			pageStatus = null;
			try {
				collection = await backend.api.collections.getById(collId);
			} catch (e) {
				pageStatus = interpretActionError(e).status;
			} finally {
				loading = false;
			}
		})();
	});

	async function handleSave(formData: FormData): Promise<void> {
		generalError = null;
		fieldErrors = {};
		formData.append("collectionId", slug);
		try {
			await backend.api.exercises.create(formData);
			router.navigate(`/collections/view/${slug}?exerciseCreated=1`);
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
	<Unauthorized message="You need to sign in to create an exercise." />
{:else if pageStatus === 404}
	<NotFound />
{:else if pageStatus === 403}
	<Forbidden message="You do not have access to this collection." />
{:else if pageStatus !== null}
	<div class="p-8 text-red-600">Error {pageStatus}</div>
{:else if !canEdit}
	<Forbidden message="You can view this collection but not add exercises to it." />
{:else}
	<ExerciseEditForm
		mode="create"
		formTitle="Create New Exercise"
		submitButtonText="Create Exercise"
		onSave={handleSave}
		onCancel={() => router.navigate(`/collections/view/${slug}`)}
		{generalError}
		{fieldErrors}
	/>
{/if}
