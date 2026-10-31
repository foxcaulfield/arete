<script lang="ts">
	import { router } from "$lib/routing/router.svelte";

	let { collections }: { collections: Collection.ResponseDto[] } = $props();

	function open(id: string): void {
		// Do not carry the list's query string: /collections uses sortBy=name|
		// createdAt|updatedAt, /collections/view uses sortBy=question|
		// totalAttempts|mostFailed. Leaking them caused 400 Validation failed
		// on GET /exercises/by_collection/:id. The filter state survives via
		// browser history (Back in the chrome) — the in-page Back button
		// intentionally returns to the unfiltered list.
		router.navigate(`/collections/view/${id}`);
	}
</script>

<div class="table-wrap">
	<table class="table caption-top w-full">
		<thead>
			<tr>
				<th>Name</th>
				<th>Description</th>
				<th>User name</th>
				<th>Created At</th>
				<th>Updated At</th>
				<th class="text-right">Exercises</th>
				<th class="text-right">Attempts</th>
				<th class="text-right">Due</th>
			</tr>
		</thead>
		<tbody class="[&>tr]:hover:preset-tonal-primary">
			{#each collections as collection (collection.id)}
				<tr
					role="button"
					tabindex="0"
					onclick={() => open(collection.id)}
					onkeydown={(e) => {
						if (e.key === "Enter" || e.key === " ") open(collection.id);
					}}
				>
					<td>{collection.name}</td>
					<td>{collection.description}</td>
					<td>{collection.user?.name}</td>
					<td>{collection.createdAt}</td>
					<td>{collection.updatedAt}</td>
					<td class="text-right">{collection.exerciseCount}</td>
					<td class="text-right">{collection.attemptCount}</td>
					<td class="text-right">
						{#if collection.dueCount !== undefined && collection.dueCount > 0}
							<span
								class="inline-flex min-w-5 items-center justify-center rounded-full bg-error-500/20 px-1.5 py-0.5 text-xs font-semibold text-error-400"
								title="{collection.dueCount} due for review"
							>
								{collection.dueCount}
							</span>
						{:else}
							<span class="text-xs text-surface-500">—</span>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
