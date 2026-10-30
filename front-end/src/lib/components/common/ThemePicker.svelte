<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { Moon, Sun } from "@lucide/svelte";
	import { theme, mode, THEME_GROUPS } from "$lib/theme.svelte";

	// 2 = compact (modal / narrow), 3 = wide (ProfilePage)
	let { columns = 2 }: { columns?: 2 | 3 } = $props();

	const gridClass = $derived(
		columns === 3 ? "grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3" : "grid grid-cols-1 gap-2 sm:grid-cols-2"
	);
</script>

<div class="space-y-4">
	<!-- Mode toggle -->
	<div class="space-y-1.5">
		<h3 class="text-[10px] font-semibold tracking-wide text-surface-400 uppercase">Mode</h3>
		<div class="grid grid-cols-2 gap-2">
			<Button
				text="Dark"
				useIcon
				IconComponent={Moon}
				size="sm"
				preset={mode.current === "dark" ? "filled" : "outlined"}
				color={mode.current === "dark" ? "primary" : "surface"}
				fullWidth
				onclick={() => mode.set("dark")}
			/>
			<Button
				text="Light"
				useIcon
				IconComponent={Sun}
				size="sm"
				preset={mode.current === "light" ? "filled" : "outlined"}
				color={mode.current === "light" ? "primary" : "surface"}
				fullWidth
				onclick={() => mode.set("light")}
			/>
		</div>
	</div>

	<!-- Themes -->
	{#each THEME_GROUPS as group (group.label)}
		<div class="space-y-1.5">
			<h3 class="text-[10px] font-semibold tracking-wide text-surface-400 uppercase">
				{group.label}
			</h3>
			<div class={gridClass}>
				{#each group.items as t (t.value)}
					{@const active = theme.current === t.value}
					<button
						type="button"
						aria-pressed={active}
						title={t.label}
						onclick={() => theme.set(t.value)}
						class="flex items-center gap-2 rounded border-2 p-2 text-left transition-colors {active
							? 'border-primary-500 bg-primary-500/10'
							: 'border-surface-700 hover:border-surface-500'}"
					>
						<span data-theme={t.value} class="flex shrink-0 gap-1" aria-hidden="true">
							<span class="h-3 w-3 rounded-full bg-primary-500"></span>
							<span class="h-3 w-3 rounded-full bg-secondary-500"></span>
							<span class="h-3 w-3 rounded-full bg-tertiary-500"></span>
							<span class="h-3 w-3 rounded-full bg-surface-500"></span>
						</span>
						<span class="truncate text-xs">{t.label}</span>
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>
