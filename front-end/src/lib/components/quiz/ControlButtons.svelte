<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { Copy, Image, ImageOff, Lightbulb, LightbulbOff, Music, Pen, TextCursorInput } from "@lucide/svelte";

	interface Props {
		currentQuestion: Quiz.QuestionDto;
		isForceTextInput: boolean;
		handleShowImage: () => void;
		handlePlayAudio: () => void;
		handleShowExplanation: () => void;
		handleForceTextInput: () => void;
		handleCopyQuestionText: () => void;
		handleClickEdit?: () => void;
		isImageShown: boolean;
		isExplanationShown: boolean;
	}

	let {
		currentQuestion,
		isForceTextInput,
		handleShowImage,
		handlePlayAudio,
		handleShowExplanation,
		handleForceTextInput,
		handleCopyQuestionText,
		handleClickEdit,
		isImageShown,
		isExplanationShown,
	}: Props = $props();

	const controlButtonStyles = "px-3 py-1.5 text-xs";
	const controlButtonTextColor = "text-surface-700 hover:text-surface-100";
	const controlButtonTextColorActive = "text-primary-400";
	const setActiveState = (isActive: boolean) => (isActive ? controlButtonTextColorActive : controlButtonTextColor);
</script>

<div class="flex">
	{#if currentQuestion.imageUrl}
		<Button
			preset="outlined"
			color={isForceTextInput ? "primary" : "surface"}
			class={`${controlButtonStyles} ${setActiveState(isImageShown)}`}
			onclick={handleShowImage}
			useIcon={true}
			IconComponent={isImageShown ? ImageOff : Image}
			isBorderless={true}
			title={isImageShown ? "Hide image" : "Show image"}
		/>
	{/if}
	{#if currentQuestion.audioUrl}
		<Button
			preset="outlined"
			color="surface"
			class={`${controlButtonStyles} ${controlButtonTextColor}`}
			onclick={handlePlayAudio}
			useIcon={true}
			IconComponent={Music}
			isBorderless={true}
			title="Play audio"
		/>
	{/if}
	{#if currentQuestion.explanation}
		<Button
			preset="outlined"
			color={isForceTextInput ? "primary" : "surface"}
			class={`${controlButtonStyles} ${setActiveState(isExplanationShown)}`}
			onclick={handleShowExplanation}
			useIcon={true}
			IconComponent={isExplanationShown ? LightbulbOff : Lightbulb}
			isBorderless={true}
			title={isExplanationShown ? "Hide explanation" : "Show explanation"}
		/>
	{/if}
	<Button
		preset="outlined"
		color={isForceTextInput ? "primary" : "surface"}
		class={`${controlButtonStyles} ${setActiveState(isForceTextInput)}`}
		onclick={handleForceTextInput}
		useIcon={true}
		IconComponent={TextCursorInput}
		isBorderless={true}
		title={isForceTextInput ? "Switch to choice mode" : "Switch to text input mode"}
	/>
	<Button
		preset="outlined"
		color="surface"
		class={`${controlButtonStyles} ${controlButtonTextColor}`}
		onclick={handleCopyQuestionText}
		useIcon={true}
		IconComponent={Copy}
		isBorderless={true}
		title="Copy question text"
	/>
	{#if handleClickEdit}
		<Button
			preset="outlined"
			color="surface"
			class={`${controlButtonStyles} ${controlButtonTextColor}`}
			onclick={handleClickEdit}
			useIcon={true}
			IconComponent={Pen}
			isBorderless={true}
			title="Edit this exercise"
		/>
	{/if}
</div>
