<script lang="ts">
	let { message = "Please sign in to continue." }: { message?: string } = $props();
</script>

<div class="card center" role="status" aria-live="polite">
	<div>
		<h2 class="accent">Unauthorized</h2>
		<p class="muted">{message}</p>
	</div>
</div>
