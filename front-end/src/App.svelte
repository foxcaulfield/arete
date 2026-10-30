<script lang="ts">
	import Layout from "$lib/components/Layout.svelte";
	import Router from "$lib/routing/Router.svelte";
	import { registerRoutes } from "$lib/routing/routes";
	import { session } from "$lib/auth/session.svelte";
	import { theme, mode } from "$lib/theme.svelte";
	import "$lib/../app.css";

	registerRoutes();
	theme.init();
	mode.init();

	$effect(() => {
		session.load();
	});
</script>

<Layout>
	<Router />
</Layout>
