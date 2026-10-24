<script lang="ts">
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";

	type Mode = "signin" | "signup";

	
	let mode = $state<Mode>("signin");
	let email = $state("");
	let password = $state("");
	let name = $state("");
	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	function toggleMode(): void {
		mode = mode === "signin" ? "signup" : "signin";
		errorMessage = null;
	}

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (submitting) return;
		submitting = true;
		errorMessage = null;

		try {
			if (mode === "signin") {
				await backend.api.auth.signin({ email, password });
			} else {
				await backend.api.auth.signup({ name, email, password });
			}
			await session.load();
			router.navigate("/");
		} catch (err) {
			errorMessage = interpretActionError(err).message;
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		if (!session.loading && session.user) {
			router.navigate("/"); // or "/collections"
		}
	});

	
</script>

<div class="mx-auto max-w-md p-8">
	<h1 class="mb-6 text-2xl font-bold">
		{mode === "signin" ? "Sign in" : "Create account"}
	</h1>

	<form onsubmit={handleSubmit} class="flex flex-col gap-4">
		{#if mode === "signup"}
			<label class="flex flex-col gap-1">
				<span class="text-sm font-medium">Name</span>
				<input type="text" bind:value={name} required autocomplete="name" class="input" />
			</label>
		{/if}

		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">Email</span>
			<input type="email" bind:value={email} required autocomplete="email" class="input" />
		</label>

		<label class="flex flex-col gap-1">
			<span class="text-sm font-medium">Password</span>
			<input
				type="password"
				bind:value={password}
				required
				minlength="8"
				autocomplete={mode === "signin" ? "current-password" : "new-password"}
				class="input"
			/>
		</label>

		{#if errorMessage}
			<div class="rounded bg-red-100 p-3 text-sm text-red-800" role="alert">
				{errorMessage}
			</div>
		{/if}

		<button type="submit" disabled={submitting} class="btn variant-filled-primary">
			{submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
		</button>
	</form>

	<button type="button" onclick={toggleMode} class="mt-4 text-sm underline">
		{mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
	</button>
</div>
