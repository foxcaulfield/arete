<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import Unauthorized from "./Unauthorized.svelte";

	let collections = $state<Collection.ResponseDto[]>([]);
	let pagination = $state<PaginatedResponse<unknown>["pagination"] | null>(null);
	let loading = $state(true);
	let errorMessage = $state<string | null>(null);

	let searchInput = $state("");

	const currentPage = $derived(parseInt(router.page.url.searchParams.get("page") ?? "1", 10) || 1);
	const limit = $derived(parseInt(router.page.url.searchParams.get("limit") ?? "10", 10) || 10);
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
			try {
				const res = await backend.api.collections.shared(p, l, s || undefined);
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
		params.set("page", String(Math.max(1, newPage)));
		router.navigate(`/collections/shared?${params.toString()}`);
	}

	function handleLimitChange(e: Event): void {
		const newLimit = parseInt((e.currentTarget as HTMLSelectElement).value, 10) || 10;
		const params = new URLSearchParams(router.page.url.search);
		params.set("limit", String(newLimit));
		params.set("page", "1");
		router.navigate(`/collections/shared?${params.toString()}`);
	}

	function applySearch(e: SubmitEvent): void {
		e.preventDefault();
		const params = new URLSearchParams(router.page.url.search);
		if (searchInput.trim()) params.set("search", searchInput.trim());
		else params.delete("search");
		params.set("page", "1");
		router.navigate(`/collections/shared?${params.toString()}`);
	}

	function clearSearch(): void {
		searchInput = "";
		const params = new URLSearchParams(router.page.url.search);
		params.delete("search");
		params.set("page", "1");
		router.navigate(`/collections/shared?${params.toString()}`);
	}

	function open(id: string): void {
		router.navigate(`/collections/view/${id}`);
	}

	function levelBadge(lvl: Collection.MyAccessLevel | undefined): string {
		switch (lvl) {
			case "EDIT":
				return "Can edit";
			case "STUDY":
				return "Can study";
			case "VIEW":
				return "View only";
			default:
				return "";
		}
	}

	function levelColor(lvl: Collection.MyAccessLevel | undefined): string {
		switch (lvl) {
			case "EDIT":
				return "bg-success-900 text-success-200 border-success-700";
			case "STUDY":
				return "bg-primary-900 text-primary-200 border-primary-700";
			case "VIEW":
				return "bg-surface-800 text-surface-300 border-surface-600";
			default:
				return "bg-surface-800 text-surface-400 border-surface-700";
		}
	}
</script>

{#if session.loading || (loading && !pagination)}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized />
{:else}
	<div class="space-y-4 p-4">
		<div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
			<div>
				<h1 class="h3 mb-1">Shared with me</h1>
				<p class="text-xs opacity-60">
					{totalItems}
					collection{totalItems !== 1 ? "s" : ""} someone shared with you
				</p>
			</div>
			<div class="flex gap-2">
				<Button
					text="Your Collections"
					type="button"
					preset="outlined"
					color="primary"
					size="sm"
					onclick={() => router.navigate("/collections")}
				/>
			</div>
		</div>

		{#if errorMessage}
			<div class="rounded bg-red-100 p-3 text-sm text-red-800">
				{errorMessage}
			</div>
		{/if}

		<div class="card preset-filled-surface-100-900 space-y-3 p-4">
			<div class="flex flex-col gap-3 border-b pb-3 border-opacity-20">
				<form onsubmit={applySearch} class="flex gap-2">
					<input
						type="text"
						bind:value={searchInput}
						placeholder="Search shared collections…"
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
					<p class="mb-2 text-sm">Nothing shared with you yet</p>
					<p class="text-xs opacity-75">When someone grants you access, their collections appear here.</p>
				</div>
			{:else}
				<div class="table-wrap">
					<table class="table w-full">
						<thead>
							<tr>
								<th>Name</th>
								<th>Owner</th>
								<th>Access</th>
								<th>Description</th>
								<th class="text-right">Exercises</th>
								<th class="text-right">Your attempts</th>
							</tr>
						</thead>
						<tbody class="[&>tr]:hover:preset-tonal-primary">
							{#each collections as c (c.id)}
								<tr
									role="button"
									tabindex="0"
									onclick={() => open(c.id)}
									onkeydown={(e) => {
										if (e.key === "Enter" || e.key === " ") open(c.id);
									}}
								>
									<td class="font-medium">{c.name}</td>
									<td class="text-xs opacity-80">{c.user?.name ?? "—"}</td>
									<td>
										<span
											class="inline-block rounded border px-2 py-0.5 text-xs font-medium {levelColor(
												c.myAccessLevel
											)}"
										>
											{levelBadge(c.myAccessLevel)}
										</span>
									</td>
									<td class="truncate text-xs opacity-70" title={c.description}>{c.description}</td>
									<td class="text-right">{c.exerciseCount ?? 0}</td>
									<td class="text-right">{c.attemptCount ?? 0}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
{/if}
