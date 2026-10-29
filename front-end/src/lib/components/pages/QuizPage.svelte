<script lang="ts">
	import { backend } from "$lib/api/client";
	import { interpretActionError } from "$lib/api/forms";
	import { session } from "$lib/auth/session.svelte";
	import { router } from "$lib/routing/router.svelte";
	import { toastSuccess, toastError } from "$lib/toast";
	import { dueCount } from "$lib/srs/due-count.svelte";
	import { tick } from "svelte";

	import Button from "$lib/components/common/Button.svelte";
	import ChoiceSingleExercise from "$lib/components/quiz/question-views/choose-single-variant.svelte";
	import FillInExercise from "$lib/components/quiz/question-views/input-text-manually.svelte";
	import ExerciseImage from "$lib/components/quiz/QuestionImage.svelte";
	import ExerciseTypeBadge from "$lib/components/quiz/QuestionTypeBadge.svelte";
	import ExplanationText from "$lib/components/quiz/QuestionExplanation.svelte";
	import ControlButtons from "$lib/components/quiz/ControlButtons.svelte";
	import Unauthorized from "./Unauthorized.svelte";

	let { slug }: { slug: string } = $props();

	interface TextPart {
		text: string;
		isAnswer: boolean;
	}

	let currentQuestion = $state<Quiz.QuestionDto | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let userAnswer = $state("");
	let submitting = $state(false);
	let showResult = $state(false);
	let isImageShown = $state(false);
	let isExplanationShown = $state(false);
	let isForceTextInput = $state(false);
	let lastResult = $state<Quiz.UserAnswerFeedbackDto | null>(null);
	let lastUserAnswer = $state("");
	let dueComplete = $state(false);

	const mode = $derived(
		(router.page.url.searchParams.get("mode") ?? "random") as "random" | "due" | "least-attempted"
	);

	let stats = $state<Quiz.CollectionStatsDto | null>(null);

	async function loadStats(): Promise<void> {
		try {
			stats = await backend.api.exercises.getDrillStats(slug);
		} catch {
			// Stats are decorative — never block the quiz on a stats fetch failure
			stats = null;
		}
	}

	let inputElement = $state<HTMLInputElement | undefined>(undefined);
	let imageElement = $state<HTMLImageElement | undefined>(undefined);
	let audioElement = $state<HTMLAudioElement | undefined>(undefined);
	let nextButtonElement = $state<HTMLButtonElement | undefined>(undefined);
	let explanationElement = $state<HTMLElement | undefined>(undefined);

	const questionParts = $derived.by((): TextPart[] => {
		if (!currentQuestion?.question) return [];
		const result: TextPart[] = [];
		const regEx = /{{(.*?)}}|([^{}]+)/g;
		let match: RegExpExecArray | null;
		while ((match = regEx.exec(currentQuestion.question)) !== null) {
			if (match[1]) result.push({ text: match[1].trim(), isAnswer: true });
			else if (match[2]) result.push({ text: match[2].trim(), isAnswer: false });
		}
		return result;
	});

	async function fetchQuestion(): Promise<void> {
		loading = true;
		error = null;
		dueComplete = false;
		try {
			currentQuestion = await backend.api.exercises.getDrillQuestion(slug, mode);
		} catch (e) {
			const err = interpretActionError(e);
			if (err.status === 404 && mode === "due") {
				// Graceful "done" state when due list is exhausted
				dueComplete = true;
				error = null;
				currentQuestion = null;
			} else {
				error = err.message;
				currentQuestion = null;
			}
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (session.loading) return;
		if (!session.user) {
			loading = false;
			return;
		}
		const s = slug;
		void s;
		void fetchQuestion();
		void loadStats();
	});

	async function submitAnswer(rawAnswer: string): Promise<void> {
		if (!currentQuestion || submitting) return;
		const answer = rawAnswer.trim();
		if (!answer) return;

		submitting = true;
		error = null;
		try {
			const result = await backend.api.exercises.submitDrillAnswer(slug, currentQuestion.id, answer);
			lastResult = result;
			lastUserAnswer = answer;
			showResult = true;
			if (result.isCorrect && currentQuestion.audioUrl) {
				await tick();
				await audioElement?.play?.().catch(() => {});
			}
			await tick();
			nextButtonElement?.focus?.();
			void loadStats();
			void dueCount.refresh(); // update nav badge immediately after each answer
		} catch (e) {
			error = interpretActionError(e).message;
		} finally {
			submitting = false;
		}
	}

	async function handleAnswerSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		// Use the DOM event's target form. currentTarget may be null post-preventDefault
		// in async handlers — so read the value synchronously here, then delegate.
		const form = e.target as HTMLFormElement | null;
		if (!form) return;
		const formData = new FormData(form);
		const answer = String(formData.get("userAnswer") ?? "");
		await submitAnswer(answer);
	}

	async function handleNext(): Promise<void> {
		isExplanationShown = false;
		isImageShown = false;
		showResult = false;
		userAnswer = "";
		lastResult = null;
		lastUserAnswer = "";
		await fetchQuestion();
		if (currentQuestion && (currentQuestion.type === "FILL_IN_THE_BLANK" || isForceTextInput)) {
			await tick();
			inputElement?.focus?.({ preventScroll: true });
		}
	}

	async function handleForceTextInput(): Promise<void> {
		isForceTextInput = !isForceTextInput;
		if (isForceTextInput) {
			await tick();
			inputElement?.focus?.();
		}
	}

	async function handleShowImage(): Promise<void> {
		isImageShown = !isImageShown;
		if (isImageShown) {
			await tick();
			imageElement?.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}

	async function handleShowExplanation(): Promise<void> {
		isExplanationShown = !isExplanationShown;
		if (isExplanationShown) {
			await tick();
			explanationElement?.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	}

	async function handlePlayAudio(): Promise<void> {
		await audioElement?.play?.().catch(() => {});
	}

	function handleCopyQuestionText(): void {
		const textToCopy = questionParts.map((part) => part.text).join(" ");
		navigator.clipboard.writeText(textToCopy).then(
			() => toastSuccess("Question copied to clipboard"),
			() => toastError("Failed to copy question")
		);
	}

	function handleClickEdit(): void {
		if (!currentQuestion) return;
		router.navigate(`/collections/view/${slug}/exercises/edit/${currentQuestion.id}`);
	}

	function exitDrill(): void {
		router.navigate(`/collections/view/${slug}`);
	}
</script>

{#if session.loading || loading}
	<div class="p-8">Loading…</div>
{:else if !session.user}
	<Unauthorized />
{:else}
	<div class="w-full p-4 md:p-6">
		<div class="mx-auto max-w-4xl">
			<div class="mb-6 flex items-center justify-between gap-4">
				<Button text="Exit" onclick={exitDrill} color="secondary" preset="outlined" size="sm" />
				{#if currentQuestion?.type}
					<ExerciseTypeBadge exerciseType={currentQuestion.type} />
				{/if}
			</div>

			{#if stats && stats.totalExercises > 0}
				<div class="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-400">
					<span>
						<strong class="text-surface-200">{stats.exercisesWithAttempts}/{stats.totalExercises}</strong>
						seen
					</span>
					<span class="opacity-40">·</span>
					<span>
						<strong class="text-surface-200">{stats.totalAttempts}</strong>
						attempts
					</span>
					{#if stats.totalAttempts > 0}
						<span class="opacity-40">·</span>
						<span>
							<strong
								class={stats.accuracy >= 0.7
									? "text-success-400"
									: stats.accuracy >= 0.4
										? "text-warning-400"
										: "text-error-400"}
							>
								{Math.round(stats.accuracy * 100)}%
							</strong>
							correct
						</span>
					{/if}
					{#if stats.streak > 0}
						<span class="opacity-40">·</span>
						<span class="text-warning-400">
							🔥 streak {stats.streak}
							{#if stats.maxStreak > stats.streak}
								<span class="text-surface-500">(best {stats.maxStreak})</span>
							{/if}
						</span>
					{/if}
				</div>
			{/if}

			{#if error}
				<div
					class="mb-4 flex items-start gap-2 rounded-lg border border-error-800 bg-error-900 p-3 text-sm text-error-400"
				>
					<svg class="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						/>
					</svg>
					<div>{error}</div>
				</div>
			{/if}

			{#if currentQuestion}
				<div class="space-y-4">
					{#if currentQuestion.audioUrl}
						<audio
							bind:this={audioElement}
							src={`/exercises/files/audio/${encodeURIComponent(currentQuestion.audioUrl)}`}
							preload="auto"
							hidden
						></audio>
					{/if}

					<div class="rounded-lg border border-surface-700 bg-surface-900 p-4 md:p-6">
						<div class="flex justify-end">
							<ControlButtons
								{currentQuestion}
								{isImageShown}
								{isExplanationShown}
								{isForceTextInput}
								{handleForceTextInput}
								{handleShowImage}
								{handleShowExplanation}
								{handlePlayAudio}
								{handleCopyQuestionText}
								{handleClickEdit}
							/>
						</div>

						<div
							class="mb-6 flex flex-col gap-4 border-b border-surface-700 pb-4 md:flex-row md:items-center md:justify-between"
						>
							<div class="text-xl leading-relaxed font-semibold text-surface-100 md:text-2xl">
								{#each questionParts as part, i (i)}
									{@const shouldReveal = part.isAnswer && showResult}
									{@const shouldHide = part.isAnswer && !showResult}
									<span
										class="rounded px-1"
										class:text-success-400={shouldReveal}
										class:bg-primary-500={shouldHide}
										class:text-primary-500={shouldHide}
									>
										{part.text}
									</span>
									{#if i < questionParts.length - 1 && !questionParts[i + 1].isAnswer && !part.isAnswer}
										<span> </span>
									{/if}
								{/each}
							</div>
						</div>

						{#if currentQuestion.translation}
							<div class="mb-4 text-sm text-surface-400">
								<span class="font-medium text-surface-300">Translation:</span>
								{currentQuestion.translation}
							</div>
						{/if}

						<form onsubmit={handleAnswerSubmit} class="mb-6">
							<input type="hidden" name="exerciseId" value={currentQuestion.id} />
							{#if currentQuestion.type === "FILL_IN_THE_BLANK" || isForceTextInput}
								<FillInExercise {showResult} bind:userAnswer bind:inputElement />
							{:else if currentQuestion.type === "CHOICE_SINGLE"}
								<ChoiceSingleExercise
									distractors={currentQuestion.distractors || []}
									{lastResult}
									{lastUserAnswer}
									{showResult}
									onSubmitChoice={submitAnswer}
								/>
							{/if}
						</form>
						<!-- <form onsubmit={handleAnswerSubmit} class="mb-6">
							<input type="hidden" name="exerciseId" value={currentQuestion.id} />
							{#if currentQuestion.type === "FILL_IN_THE_BLANK" || isForceTextInput}
								<FillInExercise {showResult} bind:userAnswer bind:inputElement />
							{:else if currentQuestion.type === "CHOICE_SINGLE"}
								<ChoiceSingleExercise
									distractors={currentQuestion.distractors || []}
									{lastResult}
									{lastUserAnswer}
									{showResult}
								/>
							{/if}
						</form> -->

						<!-- <div class="mb-6 min-h-[140px]"> -->
						<div class="mb-6 min-h-35">
							{#if showResult && lastResult}
								<div
									class="rounded-lg border-l-4 p-4 duration-300 {lastResult.isCorrect
										? 'border border-success-900 border-l-success-400 bg-success-900/20'
										: 'border border-error-900 border-l-error-400 bg-error-900/20'}"
								>
									<div class="flex items-start gap-4">
										<div class="shrink-0 pt-1 text-3xl">{lastResult.isCorrect ? "✓" : "✗"}</div>
										<div class="min-w-0 flex-1">
											<div
												class="text-lg font-bold {lastResult.isCorrect
													? 'text-success-400'
													: 'text-error-400'}"
											>
												{lastResult.isCorrect ? "Correct!" : "Not quite right"}
											</div>
											{#if !lastResult.isCorrect}
												<div class="mt-3 space-y-2 text-sm">
													<p class="text-surface-300">
														<span class="text-surface-400">Your answer:</span>
														<span class="font-medium text-error-300"
															>{lastUserAnswer || "(empty)"}</span
														>
													</p>
													<p class="text-surface-300">
														<span class="text-surface-400">Correct answer:</span>
														<span class="font-semibold text-success-300"
															>{lastResult.correctAnswer}</span
														>
													</p>
												</div>
											{/if}
										</div>
									</div>
								</div>
							{/if}
						</div>

						<div class="flex items-center justify-between gap-4 border-t border-surface-700 pt-4">
							<div>
								<Button
									disabled={showResult || submitting}
									type="button"
									onclick={handleNext}
									color="surface"
									preset="outlined"
									size="sm"
									text="Skip"
									isBorderless={true}
								/>
							</div>
							<div>
								<Button
									disabled={!showResult || submitting}
									type="button"
									bind:buttonElement={nextButtonElement}
									onclick={handleNext}
									color={showResult ? (lastResult?.isCorrect ? "success" : "error") : "surface"}
									size="sm"
									text="Next"
								/>
							</div>
						</div>
					</div>

					{#if isImageShown && currentQuestion.imageUrl}
						<div class="rounded-lg border border-surface-700 bg-surface-900 p-4 md:p-6">
							<ExerciseImage bind:imageElement imageUrl={currentQuestion.imageUrl} />
						</div>
					{/if}

					{#if isExplanationShown && currentQuestion.explanation}
						<div class="rounded-lg border border-surface-700 bg-surface-900 p-4 md:p-6">
							<ExplanationText
								bind:explanationEl={explanationElement}
								text={currentQuestion.explanation}
							/>
						</div>
					{/if}
				</div>
			{:else if dueComplete}
				<div class="rounded-lg border border-success-800 bg-success-900/20 p-8 text-center">
					<div class="mb-2 text-4xl">🎉</div>
					<h2 class="text-lg font-semibold text-success-400">All caught up!</h2>
					<p class="mt-1 text-sm text-surface-400">No exercises due for review in this collection.</p>
					<Button
						text="Back to collection"
						type="button"
						preset="outlined"
						color="surface"
						size="sm"
						class="mt-4"
						onclick={exitDrill}
					/>
				</div>
			{:else}
				<div
					class="rounded-lg border border-surface-700 bg-surface-900 p-4 text-center text-sm text-surface-400 md:p-6"
				>
					No exercises found in this collection.
				</div>
			{/if}
		</div>
	</div>
{/if}
