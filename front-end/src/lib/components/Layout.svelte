<script lang="ts">
	import type { Snippet } from "svelte";
	import { SvelteToast } from "@zerodevx/svelte-toast";
	import { BookIcon, HouseIcon, KeyIcon, Share2Icon, SparklesIcon, TreePalmIcon, UsersIcon } from "@lucide/svelte";
	import { Navigation } from "@skeletonlabs/skeleton-svelte";
	import { router } from "$lib/routing/router.svelte";
	import { session } from "$lib/auth/session.svelte";
	import { dueCount } from "$lib/srs/due-count.svelte";

	let { children }: { children: Snippet } = $props();

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			dueCount.reset();
			return;
		}
		// Refetch on every route change (endpoint is cheap)
		const _path = router.page.url.pathname;
		void _path;
		void dueCount.refresh();
	});

	const links = [
		{ href: "/", text: "Home", icon: HouseIcon },
		{ href: "/profile", text: "Profile", icon: TreePalmIcon },
		{ href: "/collections", text: "Collections", icon: BookIcon },
		{ href: "/practice", text: "Practice", icon: SparklesIcon },
		{ href: "/collections/shared", text: "Shared", icon: Share2Icon },
		{ href: "/admin/users", text: "Admin", icon: UsersIcon },
		{ href: "/auth", text: "Auth", icon: KeyIcon },
	];

	const anchorBar = "btn hover:preset-tonal flex-col items-center gap-1";

	function handleNav(e: MouseEvent, href: string): void {
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
		e.preventDefault();
		router.navigate(href);
	}
</script>

<Navigation layout="bar">
	<Navigation.Menu class="grid grid-cols-7 gap-2">
		{#each links as link (link.href)}
			{@const Icon = link.icon}
			<a href={link.href} class={anchorBar} onclick={(e) => handleNav(e, link.href)}>
				<span class="relative">
					<Icon class="size-5" />
					{#if link.href === "/collections" && dueCount.value > 0}
						<span
							class="absolute -top-1.5 -right-2 inline-flex min-w-3.5 items-center justify-center rounded-full bg-error-500 px-1 text-[8px] leading-tight font-bold text-white"
						>
							{dueCount.value > 99 ? "99+" : dueCount.value}
						</span>
					{/if}
				</span>
				<span class="text-[10px]">{link.text}</span>
			</a>
		{/each}
	</Navigation.Menu>
</Navigation>

<main>
	<SvelteToast />
	{@render children()}
</main>
