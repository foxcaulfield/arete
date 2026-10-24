<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	// import FormGroupTextInput from "../FormGroupTextInput.svelte";

	interface Props {
		showResult: boolean;
		userAnswer: string;
		inputElement: HTMLInputElement | undefined;
	}

	let { showResult, userAnswer = $bindable(), inputElement = $bindable() }: Props = $props();
	let hasValue = $derived.by(() => userAnswer.trim().length > 0);
</script>

<div class="flex">
	<input
		type="text"
		disabled={showResult}
		class={`input rounded-r-none ${hasValue && !showResult ? "bg-primary-50/30 dark:bg-primary-950/30" : ""}`}
		id="userAnswer"
		name="userAnswer"
		placeholder="Enter your answer"
		autocomplete="off"
		bind:value={userAnswer}
		bind:this={inputElement}
	/>
	<Button
		text="Answer"
		type="submit"
		isBorderless={false}
		preset={"outlined"}
		class={`ig-btn rounded-l-none ${!hasValue || showResult ? "hover:cursor-not-allowed hover:opacity-50" : "bg-primary-50/30 dark:bg-primary-950/30"}`}
		color={showResult || !hasValue ? "surface" : "primary"}
		disabled={showResult || !hasValue}
	/>
</div>
