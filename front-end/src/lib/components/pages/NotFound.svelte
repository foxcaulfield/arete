<script lang="ts">
	let { message = "Page not found." }: { message?: string } = $props();
</script>

<div class="card center" role="status" aria-live="polite">
	<div>
		<h2 class="accent">Not found</h2>
		<p class="muted">{message}</p>
	</div>
</div>
