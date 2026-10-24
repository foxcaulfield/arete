<script lang="ts">
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import {/* toastSuccess, */toastError } from "$lib/toast";
	import ExerciseEditForm from "$lib/components/exercises/ExerciseEditForm.svelte";
	import Unauthorized from "./Unauthorized.svelte";
	import Forbidden from "./Forbidden.svelte";
	import NotFound from "./NotFound.svelte";

	let { slug, id }: { slug: string; id: string } = $props();

	let exercise = $state<Exercise.ResponseDto | null>(null);
	let loading = $state(true);
	let pageStatus = $state<number | null>(null);
	let generalError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string[]>>({});
	let deleting = $state(false);

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			loading = false;
			return;
		}
		const exId = id;
		void exId;
		void (async () => {
			loading = true;
			pageStatus = null;
			try {
				exercise = await backend.api.exercises.getById(exId);
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
		try {
			await backend.api.exercises.update(id, formData);
			// toastSuccess("Exercise updated!");
			router.navigate(`/collections/view/${slug}?exerciseUpdated=1`);
		} catch (e) {
			const err = interpretActionError(e);
			generalError = err.message;
			fieldErrors = err.fields ?? {};
		}
	}

	async function handleDelete(): Promise<void> {
		if (!confirm("Delete this exercise? This cannot be undone.")) return;
		deleting = true;
		try {
			await backend.api.exercises.delete(id);
			// toastSuccess("Exercise deleted!");
			router.navigate(`/collections/view/${slug}?exerciseDeleted=1`);
		} catch (e) {
			toastError(interpretActionError(e).message);
		} finally {
			deleting = false;
		}
	}
</script>

{#if session.loading || loading}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized message="You need to sign in to edit this exercise." />
{:else if pageStatus === 404}
	<NotFound />
{:else if pageStatus === 403}
	<Forbidden />
{:else if pageStatus !== null}
	<div class="p-8 text-red-600">Error {pageStatus}</div>
{:else if exercise}
	<ExerciseEditForm
		mode="edit"
		formTitle="Edit Exercise"
		submitButtonText="Update Exercise"
		{exercise}
		onSave={handleSave}
		onCancel={() => router.navigate(`/collections/view/${slug}`)}
		onDelete={deleting ? undefined : handleDelete}
		{generalError}
		{fieldErrors}
	/>
{/if}
