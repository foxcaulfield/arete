<script lang="ts">
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import { toastError } from "$lib/toast";
	import ExerciseEditForm from "$lib/components/exercises/ExerciseEditForm.svelte";
	import Unauthorized from "./Unauthorized.svelte";
	import Forbidden from "./Forbidden.svelte";
	import NotFound from "./NotFound.svelte";

	let { slug, id }: { slug: string; id: string } = $props();

	let exercise = $state<Exercise.ResponseDto | null>(null);
	let loading = $state(true);
	let pageStatus = $state<number | null>(null);
	let pageError = $state<string | null>(null);
	let generalError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string[]>>({});
	let deleting = $state(false);

	// Server resolves effective access via getExerciseById (edit-only endpoint).
	// This is a defense-in-depth UI check — backend already 403s for STUDY/VIEW.
	const canEdit = $derived(
		exercise?.myAccessLevel === "OWNER" || exercise?.myAccessLevel === "ADMIN" || exercise?.myAccessLevel === "EDIT"
	);

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
			pageError = null;
			try {
				exercise = await backend.api.exercises.getById(exId);
			} catch (e) {
				const err = interpretActionError(e);
				pageStatus = err.status;
				pageError = err.message;
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
	<Forbidden message={pageError ?? "You do not have edit access to this exercise."} />
{:else if pageStatus !== null}
	<div class="p-8 text-red-600">Error {pageStatus}</div>
{:else if !canEdit}
	<Forbidden message="You can view this collection but not edit its exercises." />
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
