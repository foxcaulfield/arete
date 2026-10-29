<script lang="ts">
	import Modal from "$lib/components/common/Modal.svelte";
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";

	interface Props {
		open: boolean;
		user: Admin.UserListItem | null;
		onClose: () => void;
		onSuccess: () => void;
	}

	let { open, user, onClose, onSuccess }: Props = $props();

	let submitting = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (open) error = null;
	});

	async function handleConfirm(): Promise<void> {
		if (!user || submitting) return;
		submitting = true;
		error = null;
		try {
			await backend.api.admin.users.delete(user.id);
			onSuccess();
		} catch (e) {
			error = interpretActionError(e).message;
		} finally {
			submitting = false;
		}
	}
</script>

<Modal {open} {onClose} title="Delete user" description={user ? `Permanently delete ${user.name ?? user.email}?` : ""}>
	{#if user}
		<div class="space-y-3">
			{#if error}
				<div class="rounded border border-error-800 bg-error-900 p-2 text-xs text-error-300">
					{error}
				</div>
			{/if}

			<div class="rounded border border-error-800 bg-error-900/40 p-3 text-xs text-error-300">
				<p class="font-semibold">This cannot be undone.</p>
				<p class="mt-1">
					This will also delete <strong>all collections, exercises, attempts, and shares</strong>
					owned by or granted to this user.
				</p>
			</div>

			<div class="flex justify-end gap-2 border-t pt-4 border-opacity-20">
				<Button text="Cancel" type="button" preset="outlined" color="surface" size="sm" onclick={onClose} />
				<Button
					text="Delete user"
					type="button"
					preset="filled"
					color="error"
					size="sm"
					loading={submitting}
					onclick={handleConfirm}
				/>
			</div>
		</div>
	{/if}
</Modal>
