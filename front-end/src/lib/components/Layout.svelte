<script lang="ts">
	import type { Snippet } from "svelte";
	import { SvelteToast } from "@zerodevx/svelte-toast";
	import { BookIcon, HouseIcon, KeyIcon, TreePalmIcon, UsersIcon } from "@lucide/svelte";
	import { Navigation } from "@skeletonlabs/skeleton-svelte";
	import { router } from "$lib/routing/router.svelte";

	let { children }: { children: Snippet } = $props();

	const links = [
		{ href: "/", text: "Home", icon: HouseIcon },
		{ href: "/profile", text: "Profile", icon: TreePalmIcon },
		{ href: "/collections", text: "Collections", icon: BookIcon },
		{ href: "/admin/users", text: "Admin", icon: UsersIcon },
		{ href: "/auth", text: "Auth", icon: KeyIcon },
	];

	const anchorBar = "btn hover:preset-tonal flex-col items-center gap-1";

	function handleNav(e: MouseEvent, href: string): void {
		// Let modifier-clicks (Ctrl/Cmd, middle-click) open in new tab
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		router.navigate(href);
	}
</script>

<Navigation layout="bar">
	<Navigation.Menu class="grid grid-cols-5 gap-2">
		{#each links as link (link.href)}
			{@const Icon = link.icon}
			<a href={link.href} class={anchorBar} onclick={(e) => handleNav(e, link.href)}>
				<Icon class="size-5" />
				<span class="text-[10px]">{link.text}</span>
			</a>
		{/each}
	</Navigation.Menu>
</Navigation>

<main>
	<SvelteToast />
	{@render children()}
</main>
