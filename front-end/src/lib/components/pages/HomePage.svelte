<script lang="ts">
	import Unauthorized from "./Unauthorized.svelte";
	import { session } from "$lib/auth/session.svelte";
</script>

{#if session.loading}
	<p>Loading…</p>
{:else if session.user}
	<p>Welcome, {session.user.name}!</p>
{:else}
	<Unauthorized />
{/if}
