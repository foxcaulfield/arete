<script lang="ts">
	import { router } from "$lib/routing/router.svelte";

	let { collections }: { collections: Collection.ResponseDto[] } = $props();

	function open(id: string): void {
		const query = router.page.url.search;
		router.navigate(`/collections/view/${id}${query}`);
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
				<th>Exercise count</th>
				<th>Attempt count</th>
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
				</tr>
			{/each}
		</tbody>
	</table>
</div>
