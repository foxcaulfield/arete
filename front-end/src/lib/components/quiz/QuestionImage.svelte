<script lang="ts">
	interface Props {
		imageUrl: string;
		imageElement?: HTMLImageElement | undefined;
	}
	let { imageUrl, imageElement = $bindable() }: Props = $props();
</script>

<div class="media-card">
	<img
		bind:this={imageElement}
		src={`/exercises/files/image/${encodeURIComponent(imageUrl)}`}
		alt="Visual representation of the question"
		style="max-width:100%;border-radius:6px"
	/>
</div>

<style>
	.media-card {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.01), rgba(255, 255, 255, 0.02));
		padding: 1rem;
		border-radius: 8px;
		display: flex;
		justify-content: center;
		align-items: center;
	}
	.media-card img {
		width: 300px;
		height: 300px;
		object-fit: cover;
		border-radius: 6px;
	}
</style>
