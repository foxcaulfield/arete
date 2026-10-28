<script lang="ts">
	import { untrack } from "svelte";
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { toastSuccess, toastError } from "$lib/toast";

	let { collectionId }: { collectionId: string } = $props();

	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let data = $state<Admin.CollectionAccess | null>(null);

	let search = $state("");
	let userOptions = $state<Admin.UserListItem[]>([]);
	let selectedUserId = $state("");
	let accessLevel = $state<Admin.AccessLevel>("STUDY");
	let granting = $state(false);
	let revokingId = $state<string | null>(null);

	const filteredOptions = $derived(
		search.trim()
			? userOptions.filter((u) => {
					const s = search.toLowerCase();
					return u.email.toLowerCase().includes(s) || (u.name ?? "").toLowerCase().includes(s);
				})
			: userOptions
	);

	const ownerId = $derived(data?.owner?.id ?? null);

	async function load(): Promise<void> {
		loading = true;
		errorMessage = null;
		try {
			data = await backend.api.admin.collections.access.list(collectionId);
		} catch (e) {
			errorMessage = interpretActionError(e).message;
		} finally {
			loading = false;
		}
	}

	async function loadUserOptions(): Promise<void> {
		try {
			const res = await backend.api.admin.users.list(1, 100);
			userOptions = res.data;
		} catch (e) {
			toastError(interpretActionError(e).message);
		}
	}

	async function handleGrant(): Promise<void> {
		if (!selectedUserId || granting) return;
		granting = true;
		try {
			await backend.api.admin.collections.access.grant(collectionId, selectedUserId, accessLevel);
			toastSuccess("Access granted.");
			selectedUserId = "";
			await load();
		} catch (e) {
			toastError(interpretActionError(e).message);
		} finally {
			granting = false;
		}
	}

	async function handleRevoke(userId: string): Promise<void> {
		if (!confirm("Revoke this user's access to this collection?")) return;
		revokingId = userId;
		try {
			await backend.api.admin.collections.access.revoke(collectionId, userId);
			toastSuccess("Access revoked.");
			await load();
		} catch (e) {
			toastError(interpretActionError(e).message);
		} finally {
			revokingId = null;
		}
	}

	$effect(() => {
		const cid = collectionId;
		void cid;
		void untrack(async () => {
			await Promise.all([load(), loadUserOptions()]);
		});
	});

	function levelLabel(lvl: Admin.AccessLevel): string {
		return lvl === "STUDY" ? "Study" : lvl === "EDIT" ? "Edit" : "View";
	}
</script>

<div class="card space-y-3 p-3">
	<div class="flex items-center justify-between">
		<div class="text-xs font-semibold tracking-wide text-surface-300 uppercase">Sharing</div>
		{#if loading}
			<span class="text-xs text-surface-500">Loading…</span>
		{/if}
	</div>

	{#if errorMessage}
		<div class="rounded border border-error-800 bg-error-900 p-2 text-xs text-error-400">
			{errorMessage}
		</div>
	{/if}

	{#if data}
		<div>
			<div class="mb-1 block text-xs font-medium opacity-60">Owner</div>
			<div class="flex items-center justify-between rounded bg-black/10 p-2 text-xs">
				<span>{data.owner.name ?? "Unnamed"}</span>
				<span class="text-surface-400">{data.owner.email}</span>
			</div>
		</div>

		<div>
			<div class="mb-1 flex items-center justify-between">
				<span class="block text-xs font-medium opacity-60">
					Shared with ({data.grants.length})
				</span>
			</div>
			{#if data.grants.length === 0}
				<div class="rounded bg-black/5 p-2 text-xs text-surface-400">No one yet.</div>
			{:else}
				<ul class="space-y-1">
					{#each data.grants as g (g.userId)}
						<li class="flex items-center justify-between rounded bg-black/10 p-2 text-xs">
							<div class="min-w-0 flex-1">
								<div class="truncate font-medium">{g.name ?? g.email}</div>
								<div class="truncate text-surface-400">
									{g.email} · {levelLabel(g.accessLevel)} · granted {new Date(
										g.grantedAt
									).toLocaleDateString()}
								</div>
							</div>
							<Button
								text="Revoke"
								size="sm"
								preset="outlined"
								color="error"
								loading={revokingId === g.userId}
								onclick={() => handleRevoke(g.userId)}
							/>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="border-t border-surface-700 pt-3">
			<div class="mb-2 block text-xs font-medium opacity-60">Grant access</div>
			<div class="space-y-2">
				<input
					type="text"
					bind:value={search}
					placeholder="Filter users by name or email…"
					autocomplete="off"
					class="w-full rounded border border-surface-600 bg-surface-800 px-2 py-1.5 text-xs text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
				/>
				<select bind:value={selectedUserId} class="select w-full text-xs" disabled={granting}>
					<option value="">— pick a user —</option>
					{#each filteredOptions as u (u.id)}
						{#if u.id !== ownerId && !data.grants.some((g) => g.userId === u.id)}
							<option value={u.id}>
								{u.name ? `${u.name} — ` : ""}{u.email}
							</option>
						{/if}
					{/each}
				</select>
				<div class="flex gap-2">
					<select bind:value={accessLevel} class="select flex-1 text-xs" disabled={granting}>
						<option value="STUDY">Study (can quiz)</option>
						<option value="EDIT">Edit (can modify)</option>
						<option value="VIEW">View (read-only)</option>
					</select>
					<Button
						text="Grant"
						size="sm"
						preset="filled"
						color="primary"
						disabled={!selectedUserId}
						loading={granting}
						onclick={handleGrant}
					/>
				</div>
			</div>
		</div>
	{/if}
</div>
