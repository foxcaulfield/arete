<script lang="ts">
	import { GraduationCap, ListCheck, PenLine } from "@lucide/svelte";

	const typeConfig: Record<Exercise.ExerciseType, { label: string; desc: string }> = {
		CHOICE_SINGLE: {
			label: "Single Choice",
			desc: "Select the correct answer.",
		},
		FILL_IN_THE_BLANK: {
			label: "Fill in the Blank",
			desc: "Complete the sentence.",
		},
	};

	interface Props {
		exerciseType: Exercise.ExerciseType;
	}
	let { exerciseType }: Props = $props();
</script>

<div class="flex items-center gap-2.4 my-1">
	<span
		class="inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-500 shrink-0"
		title={typeConfig[exerciseType]?.label ?? "Unknown type"}
	>
		{#if exerciseType === "CHOICE_SINGLE"}
			<ListCheck size={24} />
		{:else if exerciseType === "FILL_IN_THE_BLANK"}
			<PenLine size={24} />
		{:else}
			<GraduationCap size={24} />
		{/if}
	</span>
	<div class="flex flex-col">
		<div class="font-semibold text-sm">{typeConfig[exerciseType]?.label ?? "Unknown type"}</div>
		<div class="text-xs text-slate-500">{typeConfig[exerciseType]?.desc ?? "Question type information."}</div>
	</div>
</div>
