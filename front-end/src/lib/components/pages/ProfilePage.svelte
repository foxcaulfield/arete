<script lang="ts">
	import Button from "$lib/components/common/Button.svelte";
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import Unauthorized from "./Unauthorized.svelte";
	import { formatDistanceToNow } from "date-fns";
	import ThemePicker from "../common/ThemePicker.svelte";

	let loggingOut = $state(false);
	let stats = $state<MeStats | null>(null);
	let statsLoading = $state(true);
	let statsError = $state<string | null>(null);

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			statsLoading = false;
			return;
		}
		void (async () => {
			statsLoading = true;
			statsError = null;
			try {
				stats = await backend.api.auth.meStats();
			} catch (e) {
				statsError = interpretActionError(e).message;
				stats = null;
			} finally {
				statsLoading = false;
			}
		})();
	});

	async function handleLogout(): Promise<void> {
		if (loggingOut) return;
		loggingOut = true;
		try {
			await session.logout();
			router.navigate("/");
		} finally {
			loggingOut = false;
		}
	}

	function formatRelative(iso: string | null): string {
		if (!iso) return "never";
		try {
			return formatDistanceToNow(new Date(iso), { addSuffix: true });
		} catch {
			return "—";
		}
	}

	function accuracyColor(acc: number): string {
		if (acc >= 0.7) return "text-success-400";
		if (acc >= 0.4) return "text-warning-400";
		return "text-error-400";
	}

	const srsTotal = $derived(stats ? stats.srsNew + stats.srsLearning + stats.srsMature : 0);
	const srsHasData = $derived(stats !== null && srsTotal > 0);
</script>

{#if session.loading || statsLoading}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized />
{:else}
	<div class="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
		<div>
			<h1 class="h2 mb-1">Profile</h1>
			<p class="text-sm opacity-60">{session.user.name ?? session.user.email}</p>
		</div>

		<!-- Account -->
		<div class="card space-y-3 p-4">
			<h2 class="text-xs font-semibold tracking-wide text-surface-300 uppercase">Account</h2>
			<dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
				<div>
					<dt class="text-xs opacity-60">ID</dt>
					<dd class="font-mono text-xs break-all">{session.user.id}</dd>
				</div>
				<div>
					<dt class="text-xs opacity-60">Name</dt>
					<dd>{session.user.name ?? "—"}</dd>
				</div>
				<div>
					<dt class="text-xs opacity-60">Email</dt>
					<dd>{session.user.email ?? "—"}</dd>
				</div>
			</dl>
		</div>

		{#if statsError}
			<div class="rounded border border-error-800 bg-error-900 p-3 text-sm text-error-400">
				Could not load stats: {statsError}
			</div>
		{/if}

		{#if stats}
			<!-- Content -->
			<div class="card space-y-3 p-4">
				<h2 class="text-xs font-semibold tracking-wide text-surface-300 uppercase">Your content</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div>
						<div class="text-2xl font-bold">{stats.collectionsOwned}</div>
						<div class="text-xs opacity-60">Collection{stats.collectionsOwned !== 1 ? "s" : ""} owned</div>
					</div>
					<div>
						<div class="text-2xl font-bold">{stats.collectionsSharedWithMe}</div>
						<div class="text-xs opacity-60">Shared with me</div>
					</div>
					<div>
						<div class="text-2xl font-bold">{stats.exercisesCreated}</div>
						<div class="text-xs opacity-60">Exercise{stats.exercisesCreated !== 1 ? "s" : ""} created</div>
					</div>
				</div>
			</div>

			<!-- Practice -->
			<div class="card space-y-3 p-4">
				<h2 class="text-xs font-semibold tracking-wide text-surface-300 uppercase">Practice</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<div>
						<div class="text-2xl font-bold">{stats.totalAttempts}</div>
						<div class="text-xs opacity-60">Total attempts</div>
					</div>
					<div>
						<div class="text-2xl font-bold">{stats.correctAttempts}</div>
						<div class="text-xs opacity-60">Correct</div>
					</div>
					<div>
						<div class="text-2xl font-bold {accuracyColor(stats.accuracy)}">
							{stats.totalAttempts > 0 ? Math.round(stats.accuracy * 100) + "%" : "—"}
						</div>
						<div class="text-xs opacity-60">Accuracy</div>
					</div>
				</div>

				{#if stats.totalAttempts > 0}
					<div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-sm border-opacity-20">
						{#if stats.currentStreak > 0}
							<span class="text-warning-400">
								🔥 Current streak: <strong>{stats.currentStreak}</strong>
							</span>
						{/if}
						<span class="opacity-70">
							Best streak: <strong>{stats.longestStreak}</strong>
						</span>
						<span class="ml-auto text-xs opacity-60">
							Last active {formatRelative(stats.lastActiveAt)}
						</span>
					</div>
				{:else}
					<div class="border-t pt-3 text-xs opacity-60 border-opacity-20">
						No attempts yet — start a quiz to see your progress here.
					</div>
				{/if}
			</div>

			<!-- SRS -->
			{#if srsHasData}
				<div class="card space-y-3 p-4">
					<h2 class="text-xs font-semibold tracking-wide text-surface-300 uppercase">Spaced repetition</h2>
					<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<div>
							<div class="text-2xl font-bold text-primary-400">{stats.srsNew}</div>
							<div class="text-xs opacity-60">New</div>
							<div class="text-[10px] opacity-40">never seen</div>
						</div>
						<div>
							<div class="text-2xl font-bold text-warning-400">{stats.srsLearning}</div>
							<div class="text-xs opacity-60">Learning</div>
							<div class="text-[10px] opacity-40">&lt; 3 reviews</div>
						</div>
						<div>
							<div class="text-2xl font-bold text-success-400">{stats.srsMature}</div>
							<div class="text-xs opacity-60">Mature</div>
							<div class="text-[10px] opacity-40">≥ 3 reviews</div>
						</div>
						<div>
							<div
								class="text-2xl font-bold {stats.srsDueForReview > 0
									? 'text-error-400'
									: 'text-surface-400'}"
							>
								{stats.srsDueForReview}
							</div>
							<div class="text-xs opacity-60">Due now</div>
							<div class="text-[10px] opacity-40">ready to review</div>
						</div>
					</div>

					{#if stats.srsDueForReview > 0}
						<div class="border-t pt-3 text-xs border-opacity-20">
							<Button
								text="Practice due cards"
								type="button"
								preset="filled"
								color="warning"
								size="sm"
								onclick={() => router.navigate("/practice")}
							/>
							<span class="ml-2 opacity-60">or pick a specific collection</span>
						</div>
					{/if}
				</div>
			{/if}
		{/if}

		<!-- Appearance -->
		<div class="card space-y-3 p-4">
			<div>
				<h2 class="text-xs font-semibold tracking-wide text-surface-300 uppercase">Appearance</h2>
				<p class="mt-1 text-xs opacity-60">Color theme. Saved on this device.</p>
			</div>
			<ThemePicker columns={3} />
		</div>

		<div class="flex justify-end">
			<Button
				text="Sign out"
				type="button"
				preset="filled"
				color="error"
				loading={loggingOut}
				onclick={handleLogout}
			/>
		</div>
	</div>
{/if}
