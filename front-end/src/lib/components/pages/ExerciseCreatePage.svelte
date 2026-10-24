<script lang="ts">
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	// import { toastSuccess } from "$lib/toast";
	import ExerciseEditForm from "$lib/components/exercises/ExerciseEditForm.svelte";
	import Unauthorized from "./Unauthorized.svelte";

	let { slug }: { slug: string } = $props();

	let generalError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string[]>>({});

	async function handleSave(formData: FormData): Promise<void> {
		generalError = null;
		fieldErrors = {};
		formData.append("collectionId", slug);
		try {
			await backend.api.exercises.create(formData);
			// toastSuccess("Exercise created!");
			router.navigate(`/collections/view/${slug}?exerciseCreated=1`);
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
	<Unauthorized message="You need to sign in to create an exercise." />
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
