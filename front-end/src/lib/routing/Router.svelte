<script lang="ts">
	import { router } from "./router.svelte";
	const match = $derived(router.resolve());
</script>

{#if match}
	<match.component {...match.params} />
{:else}
	<p>Page not found</p>
{/if}
