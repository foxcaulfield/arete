<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { router } from "$lib/routing/router.svelte";

	let { exercises }: { exercises: Exercise.ResponseDto[] } = $props();
</script>

<div class="table-wrap">
	<table class="table w-full table-fixed caption-top">
		<thead>
			<tr>
				<th class="w-20 align-middle"></th>
				<th class="w-[45%] align-middle">question</th>
				<th class="w-[20%] align-middle">answer</th>
				<th class="w-[15%] align-middle">type</th>
				<th class="w-[10%] align-middle text-right">attempts total</th>
				<th class="w-[10%] align-middle text-right">correct attempts</th>
			</tr>
		</thead>
		<tbody class="[&>tr]:hover:preset-tonal-surface">
			{#each exercises as exercise (exercise.id)}
				<tr>
					<td class="w-20 align-middle whitespace-nowrap">
						<Button
							text="Edit"
							size="sm"
							preset="outlined"
							color="tertiary"
							onclick={() =>
								router.navigate(
									`/collections/view/${exercise.collectionId}/exercises/edit/${exercise.id}`
								)}
						/>
					</td>
					<td title={exercise.question} class="w-[45%] truncate align-middle">{exercise.question}</td>
					<td title={exercise.correctAnswer ?? ""} class="w-[20%] truncate align-middle"
						>{exercise.correctAnswer}</td
					>
					<td title={exercise.type} class="w-[15%] truncate align-middle">{exercise.type}</td>
					<td class="w-[10%] truncate align-middle text-right">{exercise.totalAttempts}</td>
					<td class="w-[10%] truncate align-middle text-right">{exercise.correctAttempts}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
