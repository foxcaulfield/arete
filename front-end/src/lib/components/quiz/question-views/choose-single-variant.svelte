<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { mode } from "$lib/theme.svelte";

	interface Props {
		distractors: string[];
		showResult: boolean;
		lastResult: Quiz.UserAnswerFeedbackDto | null;
		lastUserAnswer: string;
		onSubmitChoice: (answer: string) => void;
	}

	const { distractors, showResult, lastResult, lastUserAnswer, onSubmitChoice }: Props = $props();
	let choiceButtons = $state<HTMLButtonElement[]>([]);

	const KEYBOARD_MAP: Record<string, number> = {
		"5": 0,
		"6": 1,
		"2": 2,
		"3": 3,
		q: 0,
		w: 1,
		a: 2,
		s: 3,
	};

	function handleKeyDown(e: KeyboardEvent): void {
		if (showResult) return;
		const buttonIndex = KEYBOARD_MAP[e.key.toLowerCase()];
		if (buttonIndex !== undefined && choiceButtons[buttonIndex]) {
			choiceButtons[buttonIndex]?.click();
		}
	}

	const isDark = $derived(mode.current === "dark");
</script>

<svelte:window onkeydown={handleKeyDown} />

<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
	{#each distractors as distractor, index (index)}
		<Button
			bind:buttonElement={choiceButtons[index]}
			disabled={showResult}
			type="button"
			onclick={() => onSubmitChoice(distractor.toLowerCase())}
			color={showResult
				? lastResult?.isCorrect
					? distractor === lastResult.correctAnswer
						? "success"
						: "secondary"
					: distractor === lastUserAnswer
						? "error"
						: distractor === lastResult?.correctAnswer
							? "success"
							: "secondary"
				: "surface"}
			preset={showResult && distractor === lastResult?.correctAnswer ? "filled" : "outlined"}
			class="!border-2 {showResult
				? ''
				: isDark
					? '!border-surface-400 !bg-surface-700 !text-surface-100 hover:!bg-surface-600 hover:!border-surface-300'
					: '!border-surface-500 !bg-surface-200 !text-surface-900 hover:!bg-surface-300 hover:!border-surface-400'}"
			text={distractor.toLowerCase()}
			fullWidth={true}
			title={`Press '${Object.entries(KEYBOARD_MAP).find(([_, i]) => i === index)?.[0] || ""}' to select`}
		/>
	{/each}
</div>
