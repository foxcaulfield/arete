<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		open: boolean;
		onClose: () => void;
		title: string;
		description?: string;
		children: Snippet;
	}

	let { open, onClose, title, description, children }: Props = $props();

	let contentEl: HTMLDivElement | undefined = $state();

	function handleBackdrop(e: MouseEvent): void {
		if (e.target === e.currentTarget) onClose();
	}

	function handleKeydown(e: KeyboardEvent): void {
		if (e.key === "Escape") onClose();
	}

	$effect(() => {
		if (open) {
			queueMicrotask(() => {
				const first = contentEl?.querySelector<HTMLElement>("input, select, textarea, button:not([disabled])");
				first?.focus();
			});
			const prev = document.body.style.overflow;
			document.body.style.overflow = "hidden";
			return (): void => {
				document.body.style.overflow = prev;
			};
		}
	});
</script>

<svelte:window onkeydown={open ? handleKeydown : undefined} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
		role="presentation"
		onclick={handleBackdrop}
	>
		<div
			bind:this={contentEl}
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
			tabindex="-1"
			class="card preset-filled-surface-100-900 w-full max-w-md space-y-4 p-6 shadow-2xl"
		>
			<div>
				<h2 id="modal-title" class="h4 font-semibold">{title}</h2>
				{#if description}
					<p class="mt-1 text-xs opacity-60">{description}</p>
				{/if}
			</div>

			{@render children()}
		</div>
	</div>
{/if}
