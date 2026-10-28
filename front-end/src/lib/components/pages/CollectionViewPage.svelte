<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import { toastSuccess, toastError } from "$lib/toast";
	import ExercisesTable from "$lib/components/exercises/ExercisesTable.svelte";
	import CollectionSharingPanel from "$lib/components/collections/CollectionSharingPanel.svelte";
	import Unauthorized from "./Unauthorized.svelte";
	import Forbidden from "./Forbidden.svelte";
	import NotFound from "./NotFound.svelte";
	import { makeSavedFilters } from "$lib/filters/saved.svelte";
	import { EXERCISE_PRESETS, EXERCISE_SORT_OPTIONS, activePresetId } from "$lib/filters/presets";
	import { X } from "@lucide/svelte";
	import { untrack } from "svelte";

	let { slug }: { slug: string } = $props();

	let collection = $state<Collection.ResponseDto | null>(null);
	let exercises = $state<Exercise.ResponseDto[]>([]);
	let pagination = $state<PaginatedResponse<unknown>["pagination"] | null>(null);
	let loading = $state(true);
	let pageStatus = $state<number | null>(null);
	let deleting = $state(false);

	// ── URL-derived ──────────────────────────────────────────────────
	const currentPage = $derived(parseInt(router.page.url.searchParams.get("page") ?? "1", 10) || 1);
	const limit = $derived(parseInt(router.page.url.searchParams.get("limit") ?? "10", 10) || 10);
	const search = $derived(router.page.url.searchParams.get("search") ?? "");
	const typeFilter = $derived(router.page.url.searchParams.get("type") ?? "");
	const hasImage = $derived(router.page.url.searchParams.get("hasImage") ?? "");
	const hasAudio = $derived(router.page.url.searchParams.get("hasAudio") ?? "");
	const sortBy = $derived(router.page.url.searchParams.get("sortBy") ?? "updatedAt");
	const sortOrder = $derived(router.page.url.searchParams.get("sortOrder") ?? "desc");
	const totalItems = $derived(pagination?.totalItems ?? 0);
	const totalPages = $derived(pagination?.totalPages ?? 0);
	const hasNext = $derived(Boolean(pagination?.hasNextPage));
	const hasPrev = $derived(Boolean(pagination?.hasPreviousPage));

	const hasAnyFilter = $derived(
		search !== "" ||
			typeFilter !== "" ||
			hasImage !== "" ||
			hasAudio !== "" ||
			sortBy !== "updatedAt" ||
			sortOrder !== "desc"
	);

	// ── Debounced search ─────────────────────────────────────────────
	let searchInput = $state("");

	$effect(() => {
		searchInput = search;
	});

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		const value = searchInput;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const params = new URLSearchParams(router.page.url.search);
			if (value.trim()) params.set("search", value.trim());
			else params.delete("search");
			params.set("page", "1");
			router.navigate(`/collections/view/${slug}?${params.toString()}`);
		}, 300);
		return (): void => clearTimeout(debounceTimer);
	});

	// ── Permissions ──────────────────────────────────────────────────
	const canEditCollection = $derived(collection?.myAccessLevel === "OWNER" || collection?.myAccessLevel === "ADMIN");
	const canEditExercises = $derived(
		collection?.myAccessLevel === "OWNER" ||
			collection?.myAccessLevel === "ADMIN" ||
			collection?.myAccessLevel === "EDIT"
	);
	const canStudy = $derived(collection?.myAccessLevel !== "VIEW" && collection?.myAccessLevel !== undefined);
	const canManageSharing = $derived(collection?.canManageSharing === true);
	const isShared = $derived(
		collection !== null &&
			collection.myAccessLevel !== undefined &&
			collection.myAccessLevel !== "OWNER" &&
			collection.myAccessLevel !== "ADMIN"
	);
	const ownerName = $derived(collection?.user?.name ?? "someone else");

	// ── Filter updates ───────────────────────────────────────────────
	function updateParam(key: string, value: string): void {
		const params = new URLSearchParams(router.page.url.search);
		if (value) params.set(key, value);
		else params.delete(key);
		params.set("page", "1");
		router.navigate(`/collections/view/${slug}?${params.toString()}`);
	}

	function clearFilters(): void {
		searchInput = "";
		router.navigate(`/collections/view/${slug}?limit=${limit}`);
	}

	function applyPreset(params: Record<string, string>): void {
		const next = new URLSearchParams();
		next.set("limit", String(limit));
		for (const [k, v] of Object.entries(params)) next.set(k, v);
		searchInput = params.search ?? "";
		router.navigate(`/collections/view/${slug}?${next.toString()}`);
	}

	const currentPresetId = $derived(
		activePresetId(EXERCISE_PRESETS, router.page.url.searchParams, {
			search: "",
			type: "",
			hasImage: "",
			hasAudio: "",
			sortBy: "updatedAt",
			sortOrder: "desc",
		})
	);

	const currentSortValue = $derived(`${sortBy}:${sortOrder}`);

	function handleSortChange(e: Event): void {
		const [newSortBy, newSortOrder] = (e.currentTarget as HTMLSelectElement).value.split(":");
		const params = new URLSearchParams(router.page.url.search);
		params.set("sortBy", newSortBy ?? "updatedAt");
		params.set("sortOrder", newSortOrder ?? "desc");
		params.set("page", "1");
		router.navigate(`/collections/view/${slug}?${params.toString()}`);
	}

	// ── Saved filters ────────────────────────────────────────────────
	// const saved = makeSavedFilters(`arete:collection:${slug}:saved-filters`);

	// slug is stable per mount (Router re-creates the component on route change),
	// but Svelte warns about local capture — untrack makes the intent explicit.
	const saved = untrack(() => makeSavedFilters(`arete:collection:${slug}:saved-filters`));
	let savingName = $state<string | null>(null);
	let savingNameInput = $state<HTMLInputElement | undefined>(undefined);

	function beginSave(): void {
		savingName = "";
		queueMicrotask(() => savingNameInput?.focus());
	}

	function confirmSave(): void {
		if (savingName === null) return;
		const params = new URLSearchParams(router.page.url.search);
		params.delete("page");
		params.delete("limit");
		const query = params.toString();
		if (!query || !savingName.trim()) {
			savingName = null;
			return;
		}
		saved.add(savingName.trim(), query);
		savingName = null;
	}

	function cancelSave(): void {
		savingName = null;
	}

	function applySaved(query: string): void {
		searchInput = "";
		router.navigate(`/collections/view/${slug}?${query}&limit=${limit}`);
	}

	// ── Load ─────────────────────────────────────────────────────────
	// Monotonic request id — drops stale responses (see CollectionsPage).
	let currentRequestId = 0;

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			loading = false;
			return;
		}
		const s = slug,
			p = currentPage,
			l = limit,
			srch = search,
			tp = typeFilter,
			hi = hasImage,
			ha = hasAudio,
			sb = sortBy,
			so = sortOrder;
		const myId = ++currentRequestId;
		void (async () => {
			loading = true;
			pageStatus = null;
			try {
				const [coll, ex] = await Promise.all([
					backend.api.collections.getById(s),
					backend.api.exercises.getListByCollectionId(s, p, l, {
						search: srch || undefined,
						type: (tp as "FILL_IN_THE_BLANK" | "CHOICE_SINGLE") || undefined,
						hasImage: (hi as "has" | "none") || undefined,
						hasAudio: (ha as "has" | "none") || undefined,
						sortBy: sb as "question" | "createdAt" | "updatedAt" | "totalAttempts" | "mostFailed",
						sortOrder: so as "asc" | "desc",
					}),
				]);
				if (myId !== currentRequestId) return;
				collection = coll;
				exercises = ex.data;
				pagination = ex.pagination;
			} catch (e) {
				if (myId !== currentRequestId) return;
				pageStatus = interpretActionError(e).status;
			} finally {
				if (myId === currentRequestId) loading = false;
			}
		})();
	});

	$effect(() => {
		const params = new URLSearchParams(router.page.url.search);
		let changed = false;
		if (params.get("created") === "1") {
			toastSuccess("Collection created!");
			params.delete("created");
			changed = true;
		}
		if (params.get("updated") === "1") {
			toastSuccess("Collection updated!");
			params.delete("updated");
			changed = true;
		}
		if (params.get("exerciseCreated") === "1") {
			toastSuccess("Exercise created!");
			params.delete("exerciseCreated");
			changed = true;
		}
		if (params.get("exerciseUpdated") === "1") {
			toastSuccess("Exercise updated!");
			params.delete("exerciseUpdated");
			changed = true;
		}
		if (params.get("exerciseDeleted") === "1") {
			toastSuccess("Exercise deleted!");
			params.delete("exerciseDeleted");
			changed = true;
		}
		if (changed) {
			const qs = params.toString();
			router.replace(`/collections/view/${slug}${qs ? `?${qs}` : ""}`);
		}
	});

	function goToPage(newPage: number): void {
		const params = new URLSearchParams(router.page.url.search);
		params.set("page", Math.max(1, newPage).toString());
		router.navigate(`/collections/view/${slug}?${params.toString()}`);
	}

	function handleLimitChange(e: Event): void {
		const newLimit = parseInt((e.currentTarget as HTMLSelectElement).value, 10) || 10;
		const params = new URLSearchParams(router.page.url.search);
		params.set("limit", newLimit.toString());
		params.set("page", "1");
		router.navigate(`/collections/view/${slug}?${params.toString()}`);
	}

	async function handleDelete(): Promise<void> {
		if (!collection) return;
		if (!confirm("Delete this collection? This cannot be undone.")) return;
		deleting = true;
		try {
			await backend.api.collections.delete(collection.id);
			router.navigate("/collections?deleted=1");
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
	<Unauthorized />
{:else if pageStatus === 404}
	<NotFound />
{:else if pageStatus === 403}
	<Forbidden />
{:else if pageStatus !== null}
	<div class="p-8 text-red-600">Error {pageStatus}</div>
{:else if collection}
	{@const c = collection}
	<div class="space-y-4 p-4">
		<div class="flex items-start justify-between gap-3">
			<div class="min-w-0 flex-1">
				<h1 class="mb-0.5 h3 truncate">{collection.name}</h1>
				<p class="line-clamp-2 text-xs opacity-60">{collection.description}</p>
				{#if isShared}
					<div
						class="mt-2 inline-flex items-center gap-1.5 rounded border border-surface-700 bg-surface-800 px-2 py-0.5 text-xs text-surface-300"
					>
						<span class="opacity-70">Shared by</span>
						<span class="font-medium">{ownerName}</span>
						<span class="opacity-50">·</span>
						<span class="font-medium">{collection.myAccessLevel}</span>
					</div>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div class="space-y-3 text-xs lg:col-span-1">
				<div class="card space-y-3 p-3">
					<div>
						<span class="mb-1 block font-medium opacity-60">Owner</span>
						<div class="rounded bg-black/10 p-2">
							<p class="font-medium">{collection.user.name ?? "Unnamed User"}</p>
							<code class="block text-xs break-all opacity-75">{collection.user.id}</code>
						</div>
					</div>
					<div>
						<span class="mb-1 block font-medium opacity-60">Collection ID</span>
						<code class="block rounded bg-black/10 p-2 text-xs break-all">{collection.id}</code>
					</div>
				</div>

				<div class="card space-y-2 p-3">
					<span class="block text-xs font-medium opacity-60">Actions</span>
					{#if canEditExercises}
						<Button
							text="Create Exercise"
							type="button"
							preset="filled"
							color="primary"
							size="sm"
							fullWidth
							onclick={() => router.navigate(`/collections/view/${c.id}/exercises/create`)}
						/>
					{/if}
					{#if canStudy}
						<Button
							text="Start Quiz"
							type="button"
							preset="filled"
							color="secondary"
							size="sm"
							fullWidth
							onclick={() => router.navigate(`/collections/view/${c.id}/exercises/quiz`)}
						/>
					{/if}
					<div class="flex gap-2">
						<Button
							text="Back"
							type="button"
							preset="outlined"
							color="surface"
							size="sm"
							class="flex-1"
							onclick={() => router.navigate("/collections")}
						/>
						{#if canEditCollection}
							<Button
								text="Edit"
								type="button"
								preset="filled"
								color="secondary"
								size="sm"
								class="flex-1"
								onclick={() => router.navigate(`/collections/edit/${c.id}`)}
							/>
						{/if}
					</div>
					{#if canEditCollection}
						<Button
							text="Delete Collection"
							type="button"
							preset="filled"
							color="error"
							size="sm"
							fullWidth
							loading={deleting}
							onclick={handleDelete}
						/>
					{/if}
				</div>

				{#if canManageSharing}
					<CollectionSharingPanel collectionId={c.id} />
				{/if}
			</div>

			<div class="lg:col-span-2">
				<div class="card space-y-3 p-4">
					<div class="flex items-center justify-between">
						<h2 class="text-base font-semibold">Exercises</h2>
						<span class="text-xs font-medium opacity-60">{totalItems} total</span>
					</div>

					<!-- Search + type -->
					<div class="flex flex-col gap-2 border-b pb-3 border-opacity-20 sm:flex-row">
						<div class="relative flex-1">
							<input
								type="text"
								bind:value={searchInput}
								placeholder="Search question, answer, translation…"
								autocomplete="off"
								class="w-full rounded border border-surface-600 bg-surface-800 px-3 py-1.5 text-sm text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
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
						<select
							class="select w-full text-xs sm:w-44"
							value={typeFilter}
							onchange={(e) => updateParam("type", (e.currentTarget as HTMLSelectElement).value)}
						>
							<option value="">All types</option>
							<option value="FILL_IN_THE_BLANK">Fill-in-the-blank</option>
							<option value="CHOICE_SINGLE">Choice single</option>
						</select>
					</div>

					<!-- Media + sort -->
					<div class="flex flex-wrap items-center gap-2 border-b pb-3 border-opacity-20">
						<select
							class="select w-fit text-xs"
							value={hasAudio}
							onchange={(e) => updateParam("hasAudio", (e.currentTarget as HTMLSelectElement).value)}
						>
							<option value="">Audio: any</option>
							<option value="has">Has audio</option>
							<option value="none">No audio</option>
						</select>
						<select
							class="select w-fit text-xs"
							value={hasImage}
							onchange={(e) => updateParam("hasImage", (e.currentTarget as HTMLSelectElement).value)}
						>
							<option value="">Image: any</option>
							<option value="has">Has image</option>
							<option value="none">No image</option>
						</select>
						<div class="flex items-center gap-1">
							<label for="ex-sort" class="text-xs font-medium opacity-60">Sort</label>
							<select
								id="ex-sort"
								class="select w-fit text-xs"
								value={currentSortValue}
								onchange={handleSortChange}
							>
								{#each EXERCISE_SORT_OPTIONS as opt (opt.value)}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</div>
						{#if hasAnyFilter}
							<button
								type="button"
								class="ml-auto text-xs text-primary-500 hover:text-primary-400"
								onclick={clearFilters}>Reset</button
							>
						{/if}
					</div>

					<!-- Presets -->
					<div class="flex flex-wrap items-center gap-1.5 border-b pb-3 border-opacity-20">
						{#each EXERCISE_PRESETS as p (p.id)}
							<button
								type="button"
								class="rounded border px-2 py-0.5 text-xs transition-colors {currentPresetId === p.id
									? 'border-primary-500 bg-primary-500/20 text-primary-300'
									: 'border-surface-600 bg-surface-800 text-surface-300 hover:border-surface-500'}"
								onclick={() => applyPreset(p.params)}
							>
								{p.label}
							</button>
						{/each}
					</div>

					<!-- Saved filters -->
					<div class="flex flex-wrap items-center gap-2 border-b pb-3 border-opacity-20">
						<span class="text-xs font-medium opacity-60">Saved:</span>
						{#if saved.items.length === 0}
							<span class="text-xs opacity-40">none yet</span>
						{:else}
							{#each saved.items as sf (sf.id)}
								<span
									class="inline-flex items-center gap-1 rounded border border-surface-600 bg-surface-800 px-1.5 py-0.5 text-xs"
								>
									<button
										type="button"
										class="text-surface-200 hover:text-primary-400"
										onclick={() => applySaved(sf.query)}
									>
										{sf.name}
									</button>
									<button
										type="button"
										class="text-surface-500 hover:text-error-400"
										title="Remove"
										onclick={() => saved.remove(sf.id)}
									>
										<X size={12} />
									</button>
								</span>
							{/each}
						{/if}
						{#if savingName === null}
							<button
								type="button"
								class="text-xs text-primary-500 hover:text-primary-400 disabled:opacity-40"
								onclick={beginSave}
								disabled={!hasAnyFilter}
							>
								+ Save current
							</button>
						{:else}
							<span class="inline-flex items-center gap-1">
								<input
									bind:this={savingNameInput}
									bind:value={savingName}
									placeholder="Filter name"
									class="rounded border border-surface-600 bg-surface-800 px-2 py-0.5 text-xs text-surface-100"
									onkeydown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											confirmSave();
										} else if (e.key === "Escape") {
											e.preventDefault();
											cancelSave();
										}
									}}
								/>
								<button
									type="button"
									class="text-xs text-success-500 hover:text-success-400"
									onclick={confirmSave}>Save</button
								>
								<button
									type="button"
									class="text-xs text-surface-400 hover:text-surface-200"
									onclick={cancelSave}>Cancel</button
								>
							</span>
						{/if}
					</div>

					<!-- Pagination -->
					<div class="flex flex-wrap items-center gap-2 border-b pb-3 border-opacity-20">
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
						<span class="ml-auto text-xs opacity-60">
							{#if totalItems > 0}
								{(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, totalItems)} of {totalItems}
							{:else}
								No items
							{/if}
						</span>
						<Button
							text="Prev"
							type="button"
							preset="outlined"
							color="surface"
							size="sm"
							disabled={!hasPrev}
							onclick={() => goToPage(currentPage - 1)}
						/>
						<Button
							text="Next"
							type="button"
							preset="outlined"
							color="surface"
							size="sm"
							disabled={!hasNext}
							onclick={() => goToPage(currentPage + 1)}
						/>
						<span class="text-xs opacity-60">Page {currentPage} of {totalPages || 1}</span>
					</div>

					{#if exercises.length === 0}
						<div class="py-12 text-center opacity-40">
							<p class="mb-2 text-sm">
								{hasAnyFilter ? "No exercises match these filters" : "No exercises yet"}
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
							{:else}
								<p class="text-xs opacity-75">Create one from the Actions panel to get started</p>
							{/if}
						</div>
					{:else}
						<div class="overflow-x-auto">
							<ExercisesTable {exercises} canEdit={canEditExercises} showAnswers={canEditExercises} />
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
