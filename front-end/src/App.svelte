<script lang="ts">
	import Layout from "$lib/components/Layout.svelte";
	import Router from "$lib/routing/Router.svelte";
	import { registerRoutes } from "$lib/routing/routes";
	import { session } from "$lib/auth/session.svelte";
	import "$lib/../app.css";

	registerRoutes();

	$effect(() => {
		session.load();
	});
</script>

<Layout>
	<Router />
</Layout>
