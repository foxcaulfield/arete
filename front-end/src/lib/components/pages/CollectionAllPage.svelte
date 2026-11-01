<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import Unauthorized from "./Unauthorized.svelte";
	import Forbidden from "./Forbidden.svelte";
	import CollectionsTable from "$lib/components/collections/CollectionsTable.svelte";
	import { COLLECTION_SORT_OPTIONS } from "$lib/filters/presets";
	import { X } from "@lucide/svelte";

	let collections = $state<Collection.ResponseDto[]>([]);
	let pagination = $state<PaginatedResponse<unknown>["pagination"] | null>(null);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);
	let pageStatus = $state<number | null>(null);

	const currentPage = $derived(parseInt(router.page.url.searchParams.get("page") ?? "1", 10) || 1);
	const limit = $derived(parseInt(router.page.url.searchParams.get("limit") ?? "20", 10) || 20);
	const search = $derived(router.page.url.searchParams.get("search") ?? "");
	const sortBy = $derived(router.page.url.searchParams.get("sortBy") ?? "updatedAt");
	const sortOrder = $derived(router.page.url.searchParams.get("sortOrder") ?? "desc");
	const totalItems = $derived(pagination?.totalItems ?? 0);
	const totalPages = $derived(pagination?.totalPages ?? 0);
	const hasNext = $derived(Boolean(pagination?.hasNextPage));
	const hasPrev = $derived(Boolean(pagination?.hasPreviousPage));

	const hasAnyFilter = $derived(search !== "" || sortBy !== "updatedAt" || sortOrder !== "desc");
	const currentSortValue = $derived(`${sortBy}:${sortOrder}`);

	// ── Debounced search ──────────────────────────────────────────────
	let searchInput = $state("");

	$effect(() => {
		searchInput = search;
	});

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const value = searchInput;
		const currentInUrl = router.page.url.searchParams.get("search") ?? "";
		// Skip on mount and redundant refires — see CollectionsPage.
		if (value === currentInUrl) return;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const params = new URLSearchParams(router.page.url.search);
			if (value.trim()) params.set("search", value.trim());
			else params.delete("search");
			params.set("page", "1");
			router.navigate(`/collections/all?${params.toString()}`);
		}, 300);
		return (): void => clearTimeout(debounceTimer);
	});

	function handleSortChange(e: Event): void {
		const [newSortBy, newSortOrder] = (e.currentTarget as HTMLSelectElement).value.split(":");
		const params = new URLSearchParams(router.page.url.search);
		params.set("sortBy", newSortBy ?? "updatedAt");
		params.set("sortOrder", newSortOrder ?? "desc");
		params.set("page", "1");
		router.navigate(`/collections/all?${params.toString()}`);
	}

	function clearFilters(): void {
		searchInput = "";
		router.navigate(`/collections/all?limit=${limit}`);
	}

	// ── Load (monotonic request id — drops stale responses) ──────────
	let currentRequestId = 0;

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			loading = false;
			return;
		}
		const p = currentPage,
			l = limit,
			s = search,
			sb = sortBy,
			so = sortOrder;
		const myId = ++currentRequestId;
		void (async () => {
			loading = true;
			errorMessage = null;
			pageStatus = null;
			try {
				const res = await backend.api.collections.all(p, l, {
					search: s || undefined,
					sortBy: sb as "name" | "createdAt" | "updatedAt",
					sortOrder: so as "asc" | "desc",
				});
				if (myId !== currentRequestId) return;
				collections = res.data;
				pagination = res.pagination;
			} catch (e) {
				if (myId !== currentRequestId) return;
				const err = interpretActionError(e);
				pageStatus = err.status;
				errorMessage = err.message;
				collections = [];
				pagination = null;
			} finally {
				if (myId === currentRequestId) loading = false;
			}
		})();
	});

	function goToPage(newPage: number): void {
		const params = new URLSearchParams(router.page.url.search);
		params.set("page", Math.max(1, newPage).toString());
		router.navigate(`/collections/all?${params.toString()}`);
	}

	function handleLimitChange(e: Event): void {
		const newLimit = parseInt((e.currentTarget as HTMLSelectElement).value, 10) || 20;
		const params = new URLSearchParams(router.page.url.search);
		params.set("limit", newLimit.toString());
		params.set("page", "1");
		router.navigate(`/collections/all?${params.toString()}`);
	}
</script>

{#if session.loading || (loading && !pagination)}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized />
{:else if pageStatus === 403}
	<Forbidden message="Admin access required." />
{:else if pageStatus !== null}
	<div class="p-8 text-red-600">Error {pageStatus}: {errorMessage}</div>
{:else}
	<div class="space-y-4 p-4">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div>
				<h1 class="h3 mb-1">All collections</h1>
				<p class="text-xs opacity-60">
					{totalItems} collection{totalItems !== 1 ? "s" : ""} across all users
				</p>
			</div>
			<div class="flex gap-2">
				<Button
					text="Back to Your Collections"
					type="button"
					preset="outlined"
					color="primary"
					size="sm"
					onclick={() => router.navigate("/collections")}
				/>
			</div>
		</div>

		{#if errorMessage}
			<div class="rounded bg-red-100 p-3 text-sm text-red-800">{errorMessage}</div>
		{/if}

		<div class="card preset-filled-surface-100-900 space-y-3 p-4">
			<!-- Search + Sort -->
			<div class="flex flex-col gap-2 border-b pb-3 border-opacity-20 sm:flex-row sm:items-center">
				<div class="relative flex-1">
					<input
						type="text"
						bind:value={searchInput}
						placeholder="Search by name, description, owner name or email…"
						autocomplete="off"
						class="w-full rounded border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 px-3 py-1.5 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
					/>
					{#if searchInput}
						<button
							type="button"
							class="absolute top-1/2 right-2 -translate-y-1/2 text-surface-400 hover:text-surface-200"
							title="Clear search"
							onclick={() => (searchInput = "")}
						>
							<X size={14} />
						</button>
					{/if}
				</div>
				<div class="flex items-center gap-2">
					<label for="sort" class="text-xs font-medium opacity-60">Sort</label>
					<select id="sort" class="select w-fit text-xs" value={currentSortValue} onchange={handleSortChange}>
						{#each COLLECTION_SORT_OPTIONS as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
					{#if hasAnyFilter}
						<button
							type="button"
							class="text-xs text-primary-500 hover:text-primary-400"
							onclick={clearFilters}>Reset</button
						>
					{/if}
				</div>
			</div>

			<!-- Pagination -->
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div class="flex items-center gap-2">
					<label for="page-limit" class="text-xs font-medium opacity-60">Show</label>
					<select
						id="page-limit"
						class="select w-fit text-xs"
						value={String(limit)}
						onchange={handleLimitChange}
					>
						<option value="10">10</option>
						<option value="20">20</option>
						<option value="50">50</option>
					</select>
					<span class="text-xs opacity-60">per page</span>
				</div>
				<div class="flex items-center gap-2">
					<Button
						text="Previous"
						type="button"
						preset="outlined"
						color="surface"
						size="sm"
						disabled={!hasPrev}
						onclick={() => goToPage(currentPage - 1)}
					/>
					<span class="text-xs opacity-60">
						{#if totalItems > 0}
							{(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, totalItems)} of {totalItems}
						{:else}
							No items
						{/if}
					</span>
					<Button
						text="Next"
						type="button"
						preset="outlined"
						color="surface"
						size="sm"
						disabled={!hasNext}
						onclick={() => goToPage(currentPage + 1)}
					/>
					<span class="ml-2 text-xs opacity-60">Page {currentPage} of {totalPages || 1}</span>
				</div>
			</div>

			{#if loading}
				<div class="py-12 text-center opacity-50">Loading…</div>
			{:else if collections.length === 0}
				<div class="py-12 text-center opacity-50">
					<p class="mb-2 text-sm">
						{hasAnyFilter ? "No collections match these filters" : "No collections found"}
					</p>
					{#if hasAnyFilter}
						<Button
							text="Clear filters"
							type="button"
							preset="outlined"
							color="surface"
							size="sm"
							onclick={clearFilters}
						/>
					{/if}
				</div>
			{:else}
				<div class="overflow-x-auto">
					<CollectionsTable {collections} variant="admin" />
				</div>
			{/if}
		</div>
	</div>
{/if}
