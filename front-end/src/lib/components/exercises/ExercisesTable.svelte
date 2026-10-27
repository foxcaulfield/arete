<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { router } from "$lib/routing/router.svelte";

	let {
		exercises,
		canEdit = false,
		showAnswers = true,
	}: {
		exercises: Exercise.ResponseDto[];
		canEdit?: boolean;
		showAnswers?: boolean;
	} = $props();
</script>

<div class="table-wrap">
	<table class="table w-full table-fixed caption-top">
		<thead>
			<tr>
				{#if canEdit}
					<th class="w-20 align-middle"></th>
				{/if}
				<th
					class="align-middle"
					class:w-[45%]={canEdit && showAnswers}
					class:w-[55%]={canEdit && !showAnswers}
					class:w-[50%]={!canEdit && showAnswers}>question</th
				>
				{#if showAnswers}
					<th class="w-[20%] align-middle">answer</th>
				{/if}
				<th class="w-[15%] align-middle">type</th>
				<th class="w-[10%] align-middle text-right">attempts total</th>
				<th class="w-[10%] align-middle text-right">correct attempts</th>
			</tr>
		</thead>
		<tbody class="[&>tr]:hover:preset-tonal-surface">
			{#each exercises as exercise (exercise.id)}
				<tr>
					{#if canEdit}
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
					{/if}
					<td title={exercise.question} class="truncate align-middle">{exercise.question}</td>
					{#if showAnswers}
						<td title={exercise.correctAnswer ?? ""} class="w-[20%] truncate align-middle"
							>{exercise.correctAnswer}</td
						>
					{/if}
					<td title={exercise.type} class="w-[15%] truncate align-middle">{exercise.type}</td>
					<td class="w-[10%] truncate align-middle text-right">{exercise.totalAttempts}</td>
					<td class="w-[10%] truncate align-middle text-right">{exercise.correctAttempts}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
