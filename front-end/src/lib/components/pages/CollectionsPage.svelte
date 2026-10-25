<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import Unauthorized from "./Unauthorized.svelte";
	import CollectionsTable from "$lib/components/collections/CollectionsTable.svelte";
	import { toastSuccess } from "$lib/toast";

	let collections = $state<Collection.ResponseDto[]>([]);
	let pagination = $state<PaginatedResponse<unknown>["pagination"] | null>(null);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	const currentPage = $derived(parseInt(router.page.url.searchParams.get("page") ?? "1", 10) || 1);
	const limit = $derived(parseInt(router.page.url.searchParams.get("limit") ?? "10", 10) || 10);
	const totalItems = $derived(pagination?.totalItems ?? 0);
	const totalPages = $derived(pagination?.totalPages ?? 0);
	const hasNext = $derived(Boolean(pagination?.hasNextPage));
	const hasPrev = $derived(Boolean(pagination?.hasPreviousPage));

	$effect(() => {
		const params = new URLSearchParams(router.page.url.search);
		if (params.get("deleted") === "1") {
			toastSuccess("Collection deleted.");
			params.delete("deleted");
			const qs = params.toString();
			router.replace(`/collections${qs ? `?${qs}` : ""}`);
		}
	});

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			loading = false;
			return;
		}
		const p = currentPage,
			l = limit;
		void p;
		void l;
		void (async () => {
			loading = true;
			errorMessage = null;
			try {
				const res = await backend.api.collections.list(p, l);
				collections = res.data;
				pagination = res.pagination;
			} catch (e) {
				errorMessage = interpretActionError(e).message;
				collections = [];
				pagination = null;
			} finally {
				loading = false;
			}
		})();
	});

	function goToPage(newPage: number): void {
		const params = new URLSearchParams(router.page.url.search);
		params.set("page", Math.max(1, newPage).toString());
		router.navigate(`/collections?${params.toString()}`);
	}

	function handleLimitChange(e: Event): void {
		const newLimit = parseInt((e.currentTarget as HTMLSelectElement).value, 10) || 10;
		const params = new URLSearchParams(router.page.url.search);
		params.set("limit", newLimit.toString());
		params.set("page", "1");
		router.navigate(`/collections?${params.toString()}`);
	}
</script>

{#if session.loading}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized />
{:else}
	<div class="space-y-4 p-4">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div>
				<h1 class="h3 mb-1">Your Collections</h1>
				<p class="text-xs opacity-60">{totalItems} collection{totalItems !== 1 ? "s" : ""} total</p>
			</div>
			<div class="flex gap-2">
				<Button
					text="All Collections"
					type="button"
					preset="outlined"
					color="primary"
					size="sm"
					onclick={() => router.navigate("/collections/all")}
				/>
				<Button
					text="Create New"
					type="button"
					preset="filled"
					color="primary"
					size="sm"
					onclick={() => router.navigate("/collections/create")}
				/>
			</div>
		</div>

		{#if errorMessage}
			<div class="rounded bg-red-100 p-3 text-sm text-red-800">{errorMessage}</div>
		{/if}

		<div class="card preset-filled-surface-100-900 space-y-3 p-4">
			<div class="flex flex-col gap-3 border-b pb-3 border-opacity-20">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div class="flex items-center gap-2">
						<label for="page-limit" class="text-xs font-medium opacity-60">Show</label>
						<select
							id="page-limit"
							class="select w-fit text-xs"
							value={String(limit)}
							onchange={handleLimitChange}
						>
							<option value="5">5</option>
							<option value="10">10</option>
							<option value="20">20</option>
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
			</div>

			{#if loading}
				<div class="py-12 text-center opacity-50">Loading…</div>
			{:else if collections.length === 0}
				<div class="py-12 text-center opacity-50">
					<p class="mb-2 text-sm">No collections yet</p>
					<p class="text-xs opacity-75">Create one to get started!</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<CollectionsTable {collections} />
				</div>
			{/if}
		</div>
	</div>
{/if}
