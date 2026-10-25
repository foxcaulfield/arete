<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import { toastSuccess, toastError } from "$lib/toast";
	import ExercisesTable from "$lib/components/exercises/ExercisesTable.svelte";

	import Unauthorized from "./Unauthorized.svelte";
	import Forbidden from "./Forbidden.svelte";
	import NotFound from "./NotFound.svelte";

	let { slug }: { slug: string } = $props();

	let collection = $state<Collection.ResponseDto | null>(null);
	let exercises = $state<Exercise.ResponseDto[]>([]);
	let pagination = $state<PaginatedResponse<unknown>["pagination"] | null>(null);
	let loading = $state(true);
	let pageStatus = $state<number | null>(null);
	let deleting = $state(false);

	const currentPage = $derived(parseInt(router.page.url.searchParams.get("page") ?? "1", 10) || 1);
	const limit = $derived(parseInt(router.page.url.searchParams.get("limit") ?? "5", 10) || 5);
	const totalItems = $derived(pagination?.totalItems ?? 0);
	const totalPages = $derived(pagination?.totalPages ?? 0);
	const hasNext = $derived(Boolean(pagination?.hasNextPage));
	const hasPrev = $derived(Boolean(pagination?.hasPreviousPage));

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			loading = false;
			return;
		}
		const s = slug,
			p = currentPage,
			l = limit;
		void s;
		void p;
		void l;
		void (async () => {
			loading = true;
			pageStatus = null;
			try {
				const [coll, ex] = await Promise.all([
					backend.api.collections.getById(s),
					backend.api.exercises.getListByCollectionId(s, p, l),
				]);
				collection = coll;
				exercises = ex.data;
				pagination = ex.pagination;
			} catch (e) {
				pageStatus = interpretActionError(e).status;
			} finally {
				loading = false;
			}
		})();
	});

	// Toast handling for query-param markers, then strip them from the URL.
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
			// router.navigate(`/collections/view/${slug}${qs ? `?${qs}` : ""}`);
			router.replace(`/collections/view/${slug}${qs ? `?${qs}` : ""}`);
		}
	});

	function goToPage(newPage: number): void {
		const params = new URLSearchParams(router.page.url.search);
		params.set("page", Math.max(1, newPage).toString());
		router.navigate(`/collections/view/${slug}?${params.toString()}`);
	}

	function handleLimitChange(e: Event): void {
		const newLimit = parseInt((e.currentTarget as HTMLSelectElement).value, 10) || 5;
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
		<div class="flex items-start justify-between">
			<div class="min-w-0 flex-1">
				<h1 class="mb-0.5 h3 truncate">{collection.name}</h1>
				<p class="line-clamp-2 text-xs opacity-60">{collection.description}</p>
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
					<Button
						text="Create Exercise"
						type="button"
						preset="filled"
						color="primary"
						size="sm"
						fullWidth
						onclick={() => router.navigate(`/collections/view/${c.id}/exercises/create`)}
					/>
					<Button
						text="Start Quiz"
						type="button"
						preset="filled"
						color="secondary"
						size="sm"
						fullWidth
						onclick={() => router.navigate(`/collections/view/${c.id}/exercises/quiz`)}
					/>
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
						<Button
							text="Edit"
							type="button"
							preset="filled"
							color="secondary"
							size="sm"
							class="flex-1"
							onclick={() => router.navigate(`/collections/edit/${c.id}`)}
						/>
					</div>
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
				</div>
			</div>

			<div class="lg:col-span-2">
				<div class="card space-y-3 p-4">
					<div class="mb-2 flex items-center justify-between">
						<h2 class="text-base font-semibold">Exercises</h2>
						<span class="text-xs font-medium opacity-60">{totalItems} total</span>
					</div>

					<div class="flex flex-wrap items-center gap-2 border-b pb-3">
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
							<p class="mb-2 text-sm">No exercises yet</p>
							<p class="text-xs opacity-75">Create one from the Actions panel to get started</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<ExercisesTable {exercises} />
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
