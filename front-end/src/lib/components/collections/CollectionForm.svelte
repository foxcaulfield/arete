<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { untrack } from "svelte";

	interface Props {
		mode: "create" | "edit";
		initialValues?: { name?: string; description?: string };
		onSave: (values: { name: string; description: string }) => Promise<void>;
		onCancel: () => void;
		generalError?: string | null;
		fieldErrors?: Record<string, string[]>;
	}

	let { mode, initialValues = {}, onSave, onCancel, generalError = null, fieldErrors = {} }: Props = $props();

	let name = $state(untrack(() => initialValues.name ?? ""));
	let description = $state(untrack(() => initialValues.description ?? ""));
	let submitting = $state(false);

	const hasNameError = $derived((fieldErrors.name?.length ?? 0) > 0);
	const hasDescriptionError = $derived((fieldErrors.description?.length ?? 0) > 0);
	const hasAnyError = $derived(hasNameError || hasDescriptionError);
	const title = $derived(mode === "create" ? "New Collection" : "Edit Collection");
	const submitText = $derived(mode === "create" ? "Create Collection" : "Update Collection");

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		try {
			await onSave({ name: name.trim(), description: description.trim() });
		} finally {
			submitting = false;
		}
	}
</script>

<div class="w-full p-4 md:p-6">
	<div class="mx-auto max-w-4xl">
		<div class="mb-6">
			<h1 class="h3 font-bold">{title}</h1>
		</div>

		{#if generalError}
			<div
				class="mb-4 flex items-start gap-2 rounded-lg border border-error-800 bg-error-900 p-3 text-sm text-error-400"
			>
				<svg class="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
						clip-rule="evenodd"
					/>
				</svg>
				<div>{generalError}</div>
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="name" class="mb-2 block text-xs font-semibold tracking-wide text-surface-300 uppercase">
					Title <span class="text-error-600">*</span>
				</label>
				<input
					id="name"
					type="text"
					bind:value={name}
					autocomplete="off"
					placeholder="e.g., Spanish Vocabulary Level 1"
					required
					class={`w-full rounded border bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none ${hasNameError ? "border-error-600" : "border-surface-600"}`}
				/>
				{#if hasNameError}
					<p class="mt-1 text-xs text-error-500">{fieldErrors.name?.[0]}</p>
				{/if}
			</div>

			<div>
				<label
					for="description"
					class="mb-2 block text-xs font-semibold tracking-wide text-surface-300 uppercase"
				>
					Description <span class="text-xs font-normal text-surface-400">(Optional)</span>
				</label>
				<textarea
					id="description"
					bind:value={description}
					placeholder="Add details about this collection... What topics does it cover? Who is it for?"
					rows="4"
					class={`w-full resize-none rounded border bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none ${hasDescriptionError ? "border-error-600" : "border-surface-600"}`}
				></textarea>
				{#if hasDescriptionError}
					<p class="mt-1 text-xs text-error-500">{fieldErrors.description?.[0]}</p>
				{/if}
			</div>

			<div class="mt-6 flex items-center justify-between gap-2 border-t border-surface-700 pt-4">
				<div class="text-xs text-surface-400">
					{#if hasAnyError}
						<span class="font-medium text-error-500">Please fix errors</span>
					{:else}
						<span>Ready to submit</span>
					{/if}
				</div>
				<div class="flex gap-2">
					<Button
						text="Cancel"
						type="button"
						color="secondary"
						preset="outlined"
						size="sm"
						onclick={onCancel}
					/>
					<Button
						text={submitText}
						type="submit"
						color="primary"
						size="sm"
						disabled={submitting}
						loading={submitting}
					/>
				</div>
			</div>
		</form>
	</div>
</div>
