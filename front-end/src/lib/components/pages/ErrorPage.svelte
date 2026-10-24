<script lang="ts">
	import { router } from "$lib/routing/router.svelte";

	const page = $derived(router.page);
	const error = $derived(page.error);
</script>

<svelte:head>
	<title>Oops! Error</title>
</svelte:head>

<div>
	{#if error}
		<h1>Oops!!! Something went wrong.</h1>
		<p>{error.message}</p>
		<p>Status Code: <strong>{page.status}</strong></p>
	{/if}
	<p>URL: <a href={page.url.href} target="_blank" rel="noopener">{page.url.href}</a></p>
</div>
