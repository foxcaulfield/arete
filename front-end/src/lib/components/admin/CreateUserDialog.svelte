<script lang="ts">
	import { untrack } from "svelte";
	import Modal from "$lib/components/common/Modal.svelte";
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";

	interface Props {
		open: boolean;
		onClose: () => void;
		onSuccess: () => void;
	}

	let { open, onClose, onSuccess }: Props = $props();

	let name = $state(untrack(() => ""));
	let email = $state(untrack(() => ""));
	let password = $state(untrack(() => ""));
	let role = $state<Admin.UserRole>(untrack(() => "USER"));
	let submitting = $state(false);
	let generalError = $state<string | null>(null);
	let fieldErrors = $state<Record<string, string[]>>({});

	$effect(() => {
		if (open) {
			name = "";
			email = "";
			password = "";
			role = "USER";
			generalError = null;
			fieldErrors = {};
		}
	});

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		generalError = null;
		fieldErrors = {};
		try {
			await backend.api.admin.users.create({
				name: name.trim(),
				email: email.trim(),
				password,
				role,
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

<Modal {open} {onClose} title="New user" description="Create a new account with a temporary password.">
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
				required
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
				required
				autocomplete="off"
				class="w-full rounded border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
			/>
			{#if fieldErrors.email?.[0]}
				<span class="mt-1 block text-xs text-error-500">{fieldErrors.email[0]}</span>
			{/if}
		</label>

		<label class="block">
			<span class="mb-1 block text-xs font-semibold tracking-wide text-surface-300 uppercase">Password</span>
			<input
				type="password"
				bind:value={password}
				required
				minlength="8"
				autocomplete="new-password"
				class="w-full rounded border border-surface-600 bg-surface-800 px-3 py-2 text-sm text-surface-100 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
			/>
			{#if fieldErrors.password?.[0]}
				<span class="mt-1 block text-xs text-error-500">{fieldErrors.password[0]}</span>
			{/if}
			<span class="mt-1 block text-xs opacity-50">Minimum 8 characters.</span>
		</label>

		<label class="block">
			<span class="mb-1 block text-xs font-semibold tracking-wide text-surface-300 uppercase">Role</span>
			<select bind:value={role} class="select w-full text-sm">
				<option value="USER">User</option>
				<option value="ADMIN">Admin</option>
			</select>
		</label>

		<div class="flex justify-end gap-2 border-t pt-4 border-opacity-20">
			<Button text="Cancel" type="button" preset="outlined" color="surface" size="sm" onclick={onClose} />
			<Button text="Create user" type="submit" preset="filled" color="primary" size="sm" loading={submitting} />
		</div>
	</form>
</Modal>
