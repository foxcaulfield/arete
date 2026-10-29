<script lang="ts">
	import { untrack } from "svelte";
	import Modal from "$lib/components/common/Modal.svelte";
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";

	interface Props {
		open: boolean;
		user: Admin.UserListItem | null;
		onClose: () => void;
		onSuccess: () => void;
	}

	let { open, user, onClose, onSuccess }: Props = $props();

	let name = $state(untrack(() => ""));
	let email = $state(untrack(() => ""));
	let role = $state<Admin.UserRole>(untrack(() => "USER"));
	let isActive = $state(untrack(() => true));
	let submitting = $state(false);
	let generalError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string[]>>({});

	const isSelf = $derived(user !== null && session.user !== null && user.id === session.user.id);

	$effect(() => {
		if (open && user) {
			name = user.name ?? "";
			email = user.email;
			role = (user.role as Admin.UserRole) ?? "USER";
			isActive = user.isActive;
			generalError = null;
			fieldErrors = {};
		}
	});

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (!user || submitting) return;
		submitting = true;
		generalError = null;
		fieldErrors = {};
		try {
			await backend.api.admin.users.update(user.id, {
				name: name.trim(),
				email: email.trim(),
				role,
				isActive,
			});
			onSuccess();
		} catch (e) {
			const err = interpretActionError(e);
			generalError = err.message;
			fieldErrors = err.fields ?? {};
		} finally {
			submitting = false;
		}
	}
</script>

<Modal {open} {onClose} title="Edit user" description={user?.email ?? ""}>
	{#if user}
		<form onsubmit={handleSubmit} class="space-y-4">
			{#if generalError}
				<div class="rounded border border-error-800 bg-error-900 p-2 text-xs text-error-300">
					{generalError}
				</div>
			{/if}

			<label class="block">
				<span class="mb-1 block text-xs font-semibold tracking-wide text-surface-300 uppercase">Name</span>
				<input
					type="text"
					bind:value={name}
					autocomplete="off"
					class="w-full rounded border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
				/>
				{#if fieldErrors.name?.[0]}
					<span class="mt-1 block text-xs text-error-500">{fieldErrors.name[0]}</span>
				{/if}
			</label>

			<label class="block">
				<span class="mb-1 block text-xs font-semibold tracking-wide text-surface-300 uppercase">Email</span>
				<input
					type="email"
					bind:value={email}
					autocomplete="off"
					class="w-full rounded border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
				/>
				{#if fieldErrors.email?.[0]}
					<span class="mt-1 block text-xs text-error-500">{fieldErrors.email[0]}</span>
				{/if}
			</label>

			<label class="block">
				<span class="mb-1 block text-xs font-semibold tracking-wide text-surface-300 uppercase">Role</span>
				<select
					bind:value={role}
					disabled={isSelf}
					class="select w-full text-sm"
					title={isSelf ? "Cannot change your own role" : ""}
				>
					<option value="USER">User</option>
					<option value="ADMIN">Admin</option>
					<option value="MODERATOR">Moderator</option>
				</select>
				{#if isSelf}
					<span class="mt-1 block text-xs opacity-50">Cannot change your own role.</span>
				{/if}
			</label>

			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={isActive} disabled={isSelf} class="h-4 w-4" />
				<span class="text-sm">Active (can sign in)</span>
			</label>
			{#if isSelf}
				<span class="block text-xs opacity-50">Cannot deactivate your own account.</span>
			{:else if !isActive}
				<span class="block text-xs text-warning-500">
					User will be signed out immediately and unable to sign in until reactivated.
				</span>
			{/if}

			<div class="flex justify-end gap-2 border-t pt-4 border-opacity-20">
				<Button text="Cancel" type="button" preset="outlined" color="surface" size="sm" onclick={onClose} />
				<Button
					text="Save changes"
					type="submit"
					preset="filled"
					color="primary"
					size="sm"
					loading={submitting}
				/>
			</div>
		</form>
	{/if}
</Modal>
