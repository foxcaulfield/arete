<script lang="ts">
	import markdownit from "markdown-it";
	interface Props {
		text: string;
		explanationEl?: HTMLElement;
	}
	let { text, explanationEl = $bindable() }: Props = $props();
	const md = markdownit({ html: true, linkify: true, typographer: true, breaks: true });
	// const renderedText = md.render(text);
	const renderedText = $derived(md.render(text));
</script>

<div class="explanation-card" bind:this={explanationEl} tabindex="-1" aria-live="polite">
	<strong>Explanation:</strong>
	<div class="content">
		{@html renderedText}
	</div>
</div>

<style>
	.explanation-card {
		/* white-space: pre-line; */
		width: 100%;
		/* word-break: keep-all; */
		overflow-wrap: break-word;
		margin-top: 1rem;
		padding: 1rem;
		background-color: var(--card-bg);
		border: var(--default-border);
		border-radius: 8px;
	}

	/* scroll inside container */
	.explanation-card .content {
		max-height: 300px;
		overflow-y: auto;
	}
</style>
