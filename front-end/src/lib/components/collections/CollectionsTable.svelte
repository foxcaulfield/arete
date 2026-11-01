<script lang="ts">
	import { router } from "$lib/routing/router.svelte";

	let {
		collections,
		variant = "own",
	}: {
		collections: Collection.ResponseDto[];
		variant?: "own" | "admin";
	} = $props();

	function open(id: string): void {
		// Detail view starts clean — the list's query params (search/sortBy on
		// names) don't match the detail view's schema (sortBy on questions /
		// attempts). Filter state on the list survives via browser Back.
		router.navigate(`/collections/view/${id}`);
	}
</script>

<div class="table-wrap">
	<table class="table caption-top w-full">
		<thead>
			<tr>
				<th>Name</th>
				<th>Description</th>
				<th>{variant === "admin" ? "Owner" : "User name"}</th>
				<th>Created At</th>
				<th>Updated At</th>
				<th class="text-right">Exercises</th>
				{#if variant === "own"}
					<th class="text-right">Attempts</th>
					<th class="text-right">Due</th>
				{/if}
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
					<td>
						{collection.user?.name ?? collection.user?.email ?? "—"}
					</td>
					<td>{collection.createdAt}</td>
					<td>{collection.updatedAt}</td>
					<td class="text-right">{collection.exerciseCount ?? 0}</td>
					{#if variant === "own"}
						<td class="text-right">{collection.attemptCount ?? 0}</td>
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
					{/if}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
