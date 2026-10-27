<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import Unauthorized from "./Unauthorized.svelte";
	import Forbidden from "./Forbidden.svelte";

	let users = $state<Admin.UserListItem[]>([]);
	let pagination = $state<PaginatedResponse<unknown>["pagination"] | null>(null);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let pageStatus = $state<number | null>(null);

	let searchInput = $state("");

	let selectedUser = $state<Admin.UserListItem | null>(null);
	let userAccess = $state<Admin.UserAccess | null>(null);
	let accessLoading = $state(false);

	const currentPage = $derived(parseInt(router.page.url.searchParams.get("page") ?? "1", 10) || 1);
	const limit = $derived(parseInt(router.page.url.searchParams.get("limit") ?? "20", 10) || 20);
	const search = $derived(router.page.url.searchParams.get("search") ?? "");
	const totalItems = $derived(pagination?.totalItems ?? 0);
	const totalPages = $derived(pagination?.totalPages ?? 0);
	const hasNext = $derived(Boolean(pagination?.hasNextPage));
	const hasPrev = $derived(Boolean(pagination?.hasPreviousPage));

	$effect(() => {
		searchInput = search;
	});

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			loading = false;
			return;
		}
		const p = currentPage,
			l = limit,
			s = search;
		void p;
		void l;
		void s;
		void (async () => {
			loading = true;
			errorMessage = null;
			pageStatus = null;
			try {
				const res = await backend.api.admin.users.list(p, l, s || undefined);
				users = res.data;
				pagination = res.pagination;
			} catch (e) {
				const err = interpretActionError(e);
				pageStatus = err.status;
				errorMessage = err.message;
				users = [];
				pagination = null;
			} finally {
				loading = false;
			}
		})();
	});

	$effect(() => {
		const u = selectedUser;
		if (!u) {
			userAccess = null;
			return;
		}
		void (async () => {
			accessLoading = true;
			try {
				userAccess = await backend.api.admin.users.access(u.id);
			} catch (e) {
				userAccess = null;
				errorMessage = interpretActionError(e).message;
			} finally {
				accessLoading = false;
			}
		})();
	});

	function goToPage(newPage: number): void {
		const params = new URLSearchParams(router.page.url.search);
		params.set("page", String(Math.max(1, newPage)));
		router.navigate(`/admin/users?${params.toString()}`);
	}

	function applySearch(e: SubmitEvent): void {
		e.preventDefault();
		const params = new URLSearchParams(router.page.url.search);
		if (searchInput.trim()) params.set("search", searchInput.trim());
		else params.delete("search");
		params.set("page", "1");
		router.navigate(`/admin/users?${params.toString()}`);
	}

	function clearSearch(): void {
		searchInput = "";
		const params = new URLSearchParams(router.page.url.search);
		params.delete("search");
		params.set("page", "1");
		router.navigate(`/admin/users?${params.toString()}`);
	}
</script>

{#if session.loading}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized />
{:else if pageStatus === 403}
	<Forbidden message="Admin access required." />
{:else if pageStatus !== null && pageStatus !== 403}
	<div class="p-8 text-red-600">Error {pageStatus}: {errorMessage}</div>
{:else}
	<div class="space-y-4 p-4">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div>
				<h1 class="h3 mb-1">Users</h1>
				<p class="text-xs opacity-60">{totalItems} user{totalItems !== 1 ? "s" : ""}</p>
			</div>
			<form onsubmit={applySearch} class="flex gap-2">
				<input
					type="text"
					bind:value={searchInput}
					placeholder="Search by name or email…"
					autocomplete="off"
					class="w-full rounded border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none md:w-64"
				/>
				<Button text="Search" type="submit" size="sm" preset="filled" color="primary" />
				{#if search}
					<Button
						text="Clear"
						type="button"
						size="sm"
						preset="outlined"
						color="surface"
						onclick={clearSearch}
					/>
				{/if}
			</form>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div class="lg:col-span-2">
				<div class="card space-y-3 p-4">
					{#if loading}
						<div class="py-12 text-center opacity-50">Loading…</div>
					{:else if users.length === 0}
						<div class="py-12 text-center opacity-50">No users match.</div>
					{:else}
						<div class="table-wrap">
							<table class="table w-full">
								<thead>
									<tr>
										<th>Name</th>
										<th>Email</th>
										<th>Role</th>
										<th class="text-right">Active</th>
										<th></th>
									</tr>
								</thead>
								<tbody class="[&>tr]:hover:preset-tonal-surface">
									{#each users as u (u.id)}
										<tr
											role="button"
											tabindex="0"
											class={selectedUser?.id === u.id ? "preset-tonal-primary" : ""}
											onclick={() => (selectedUser = u)}
											onkeydown={(e) => {
												if (e.key === "Enter" || e.key === " ") selectedUser = u;
											}}
										>
											<td>{u.name ?? "—"}</td>
											<td>{u.email}</td>
											<td>{u.role}</td>
											<td class="text-right">{u.isActive ? "✓" : "✗"}</td>
											<td>
												<Button
													text="View"
													size="sm"
													preset="ghost"
													color="surface"
													onclick={(e) => {
														e.stopPropagation();
														selectedUser = u;
													}}
												/>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}

					<div class="flex items-center justify-between border-t pt-3 border-opacity-20">
						<span class="text-xs opacity-60">Page {currentPage} of {totalPages || 1}</span>
						<div class="flex gap-2">
							<Button
								text="Prev"
								size="sm"
								preset="outlined"
								color="surface"
								disabled={!hasPrev}
								onclick={() => goToPage(currentPage - 1)}
							/>
							<Button
								text="Next"
								size="sm"
								preset="outlined"
								color="surface"
								disabled={!hasNext}
								onclick={() => goToPage(currentPage + 1)}
							/>
						</div>
					</div>
				</div>
			</div>

			<div class="lg:col-span-1">
				<div class="card space-y-3 p-4">
					{#if !selectedUser}
						<div class="py-12 text-center text-xs opacity-50">Select a user to see their access.</div>
					{:else}
						<div>
							<div class="mb-1 block text-xs font-medium opacity-60">User</div>
							<div class="rounded bg-black/10 p-2 text-xs">
								<div class="font-medium">{selectedUser.name ?? "Unnamed"}</div>
								<div class="text-surface-400">{selectedUser.email}</div>
								<div class="mt-1 text-surface-400">
									{selectedUser.role} · {selectedUser.isActive ? "active" : "inactive"}
								</div>
							</div>
						</div>

						{#if accessLoading}
							<div class="text-xs text-surface-400">Loading access…</div>
						{:else if userAccess}
							<div>
								<div class="mb-1 block text-xs font-medium opacity-60">
									Owns ({userAccess.owned.length})
								</div>
								{#if userAccess.owned.length === 0}
									<div class="rounded bg-black/5 p-2 text-xs text-surface-400">None.</div>
								{:else}
									<ul class="space-y-1">
										{#each userAccess.owned as c (c.id)}
											<li class="rounded bg-black/10 p-2 text-xs">{c.name}</li>
										{/each}
									</ul>
								{/if}
							</div>

							<div>
								<div class="mb-1 block text-xs font-medium opacity-60">
									Has access to ({userAccess.shared.length})
								</div>
								{#if userAccess.shared.length === 0}
									<div class="rounded bg-black/5 p-2 text-xs text-surface-400">None.</div>
								{:else}
									<ul class="space-y-1">
										{#each userAccess.shared as s (s.collectionId)}
											<li class="rounded bg-black/10 p-2 text-xs">
												<div class="font-medium">{s.name}</div>
												<div class="text-surface-400">
													by {s.ownerName ?? s.ownerId} · {s.accessLevel}
												</div>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
