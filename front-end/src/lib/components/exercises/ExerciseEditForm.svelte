<script lang="ts">
	import { untrack } from "svelte";
	import Button from "$lib/components/common/Button.svelte";
	import MediaField from "$lib/components/MediaField.svelte";
	import type { Snippet } from "svelte";
	import { TagsInput } from "@skeletonlabs/skeleton-svelte";
	import { toastSuccess, toastWarning } from "$lib/toast";
	import { X } from "@lucide/svelte";

	interface Props {
		mode: "create" | "edit";
		formTitle: string;
		submitButtonText: string;
		exercise?: Exercise.ResponseDto | null;
		fieldErrors?: Record<string, string[]>;
		generalError?: string | null;
		onSave: (formData: FormData) => Promise<void>;
		onCancel: () => void;
		onDelete?: () => void;
		headerSnippet?: Snippet;
	}

	// Defensive: parse JSON string if backend hasn't done it yet
	function toArray(value: unknown): string[] {
		if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
		if (typeof value === "string") {
			try {
				const parsed: unknown = JSON.parse(value);
				return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
			} catch {
				return [];
			}
		}
		return [];
	}

	let {
		mode,
		exercise = null,
		fieldErrors = {},
		generalError = null,
		onSave,
		onCancel,
		onDelete,
		headerSnippet,
		formTitle,
		submitButtonText,
	}: Props = $props();

	const exerciseTypes: Exercise.ExerciseType[] = ["FILL_IN_THE_BLANK", "CHOICE_SINGLE"];
	const randomId = (): number => Math.floor(Math.random() * 1_000_000);

	// ── Content state (snapshot once at mount, then user-controlled) ──────────
	let selectedType = $state<Exercise.ExerciseType | undefined>(untrack(() => exercise?.type ?? "FILL_IN_THE_BLANK"));
	let questionText = $state(untrack(() => exercise?.question ?? ""));
	let translationText = $state(untrack(() => exercise?.translation ?? ""));
	let correctAnswerText = $state(untrack(() => exercise?.correctAnswer ?? ""));
	let explanationText = $state(untrack(() => exercise?.explanation ?? ""));

	// ── Clear/undo flags ──────────────────────────────────────────────────────
	let clearExplanation = $state(false);
	let clearTranslation = $state(false);
	let canClearAdditionalAnswers = $state(false);
	let canClearDistractors = $state(false);

	// ── Saved values for undo ─────────────────────────────────────────────────
	let savedExplanation = "";
	let savedTranslation = "";
	let savedAdditionalAnswers: Array<{ id: number; value: string }> = [];
	let savedDistractors: Array<{ id: number; value: string }> = [];

	// ── Arrays ────────────────────────────────────────────────────────────────
	// let additionalCorrectAnswers = $state<Array<{ id: number; value: string }>>(
	// 	untrack(() => (exercise?.additionalCorrectAnswers || []).map((ans) => ({ id: randomId(), value: ans })))
	// );
	// let distractors = $state<Array<{ id: number; value: string }>>(
	// 	untrack(() => (exercise?.distractors || []).map((dist) => ({ id: randomId(), value: dist })))
	// );
	let additionalCorrectAnswers = $state<Array<{ id: number; value: string }>>(
		untrack(() => toArray(exercise?.additionalCorrectAnswers).map((ans) => ({ id: randomId(), value: ans })))
	);
	let distractors = $state<Array<{ id: number; value: string }>>(
		untrack(() => toArray(exercise?.distractors).map((dist) => ({ id: randomId(), value: dist })))
	);

	// ── Form plumbing ─────────────────────────────────────────────────────────
	let formEl: HTMLFormElement | undefined = $state();
	let submitting = $state(false);
	let tagsResetKey = $state(0);

	const questionLength = $derived(questionText.length);
	const translationLength = $derived(translationText.length);

	const questionMinLength = 5;
	const questionMaxLength = 300;
	const answerMaxLength = 50;
	const translationMaxLength = 300;

	const hasQuestionError = $derived(Boolean(fieldErrors.question?.length));
	const hasAnswerError = $derived(Boolean(fieldErrors.correctAnswer?.length));
	const hasTypeError = $derived(Boolean(fieldErrors.type?.length));
	const hasTranslationError = $derived(Boolean(fieldErrors.translation?.length));
	const hasExplanationError = $derived(Boolean(fieldErrors.explanation?.length));

	const keepOnlyUnique = (arr: string[]): string[] => [...new Set(arr)];
	const toAnswerWithId = (val: string) => ({ id: randomId(), value: val });
	const toTrimmedLower = (val: string) => val.trim().toLowerCase();

	type ValChangeInfo = { value: string[]; inputValue: string };

	const splitCommaSeparatedValues = (val: string): string[] =>
		val
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s.length > 0);

	const _handleValidateExtraAnswersInput =
		(warningMessage: string) =>
		({ value, inputValue }: ValChangeInfo): boolean => {
			if (value.map(toTrimmedLower).includes(toTrimmedLower(inputValue))) {
				toastWarning(warningMessage);
				return false;
			}
			return true;
		};

	function handleValidateAdditionalAnswersInput({ value, inputValue }: ValChangeInfo): boolean {
		const splitValues = splitCommaSeparatedValues(inputValue);
		if (splitValues.length > 1) {
			for (const splitVal of splitValues) {
				if (value.map(toTrimmedLower).includes(toTrimmedLower(splitVal))) {
					toastWarning("Duplicate alternative value");
					return false;
				}
			}
			return true;
		}
		return _handleValidateExtraAnswersInput("Duplicate alternative value")({ value, inputValue });
	}

	function handleValidateDistractorsInput({ value, inputValue }: ValChangeInfo): boolean {
		const splitValues = splitCommaSeparatedValues(inputValue);
		if (splitValues.length > 1) {
			for (const splitVal of splitValues) {
				if (value.map(toTrimmedLower).includes(toTrimmedLower(splitVal))) {
					toastWarning("Duplicate distractor value");
					return false;
				}
			}
			return true;
		}
		return _handleValidateExtraAnswersInput("Duplicate distractor value")({ value, inputValue });
	}

	function handleDistractorsChange({ value }: { value: string[] }): void {
		const allValues = value.flatMap((v) => splitCommaSeparatedValues(v));
		distractors = keepOnlyUnique(allValues).map(toAnswerWithId);
		if (allValues.length > 0) canClearDistractors = false;
	}

	function handleAdditionalAnswersChange({ value }: { value: string[] }): void {
		const allValues = value.flatMap((v) => splitCommaSeparatedValues(v));
		additionalCorrectAnswers = keepOnlyUnique(allValues).map(toAnswerWithId);
		if (allValues.length > 0) canClearAdditionalAnswers = false;
	}

	// ── Clear / undo (single copy, with save-restore) ─────────────────────────
	function handleClearExplanation(): void {
		savedExplanation = explanationText;
		explanationText = "";
		clearExplanation = true;
		toastWarning("Explanation will be removed");
	}
	function handleUndoClearExplanation(): void {
		clearExplanation = false;
		explanationText = savedExplanation || (exercise?.explanation ?? "");
		savedExplanation = "";
	}

	function handleClearTranslation(): void {
		savedTranslation = translationText;
		translationText = "";
		clearTranslation = true;
		toastWarning("Translation will be removed");
	}
	function handleUndoClearTranslation(): void {
		clearTranslation = false;
		translationText = savedTranslation || (exercise?.translation ?? "");
		savedTranslation = "";
	}

	function handleClearAdditionalAnswers(): void {
		savedAdditionalAnswers = [...additionalCorrectAnswers];
		additionalCorrectAnswers = [];
		canClearAdditionalAnswers = true;
		toastWarning("All alternatives will be removed");
	}
	function handleUndoClearAdditionalAnswers(): void {
		canClearAdditionalAnswers = false;
		additionalCorrectAnswers =
			savedAdditionalAnswers.length > 0
				? savedAdditionalAnswers
				: (exercise?.additionalCorrectAnswers || []).map(toAnswerWithId);
		savedAdditionalAnswers = [];
		tagsResetKey += 1;
	}

	function handleClearDistractors(): void {
		savedDistractors = [...distractors];
		distractors = [];
		canClearDistractors = true;
		toastWarning("All distractors will be removed");
	}
	function handleUndoClearDistractors(): void {
		canClearDistractors = false;
		distractors =
			savedDistractors.length > 0 ? savedDistractors : (exercise?.distractors || []).map(toAnswerWithId);
		savedDistractors = [];
		tagsResetKey += 1;
	}

	// ── Form submission ───────────────────────────────────────────────────────
	function appendArrayOrEmpty(
		formData: FormData,
		key: string,
		arr: Array<{ id: number; value: string }>,
		canClear: boolean
	): void {
		if (canClear || arr.length === 0) {
			formData.append(key, "");
		} else if (arr.length === 1) {
			const first = arr[0];
			if (first) formData.append(`${key}[]`, first.value);
		} else {
			arr.forEach((a) => formData.append(key, a.value));
		}
	}

	async function handleSubmit(e: SubmitEvent): Promise<void> {
		e.preventDefault();
		if (submitting || !formEl) return;
		submitting = true;
		try {
			const formData = new FormData(formEl);
			appendArrayOrEmpty(
				formData,
				"additionalCorrectAnswers",
				additionalCorrectAnswers,
				canClearAdditionalAnswers
			);
			appendArrayOrEmpty(formData, "distractors", distractors, canClearDistractors);
			if (clearExplanation || explanationText.trim().length === 0) formData.set("explanation", "");
			if (clearTranslation || translationText.trim().length === 0) formData.set("translation", "");
			await onSave(formData);
		} finally {
			submitting = false;
		}
	}

	function formatExerciseType(type: string): string {
		return type.replaceAll("_", " ").toLowerCase();
	}
</script>

<div class="w-full p-4 md:p-6">
	<div class="mx-auto max-w-4xl">
		<div class="mb-6 flex items-center justify-between gap-4">
			<div>
				{#if headerSnippet}
					{@render headerSnippet()}
				{:else}
					<h1 class="h3 font-bold">{formTitle}</h1>
				{/if}
			</div>
			{#if mode === "edit" && onDelete}
				<Button text="Delete" type="button" color="error" preset="outlined" size="sm" onclick={onDelete} />
			{/if}
		</div>

		{#if generalError}
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
				<div>{generalError}</div>
			</div>
		{/if}

		<form bind:this={formEl} onsubmit={handleSubmit} enctype="multipart/form-data" class="space-y-4">
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div class="lg:col-span-1">
					<label
						for="exercise-type-radio-0"
						class="mb-2 block text-xs font-semibold tracking-wide text-surface-300 uppercase"
					>
						Type <span class="text-error-600">*</span>
					</label>
					<div class="space-y-2">
						{#each exerciseTypes as type, i}
							<label
								class="flex cursor-pointer items-center rounded border border-surface-600 p-2 transition-colors peer-has-checked:border-primary-500 hover:bg-surface-800"
							>
								<input
									id={"exercise-type-radio-" + i}
									type="radio"
									name="type"
									value={type}
									checked={type === selectedType}
									onchange={() => (selectedType = type)}
									class="h-4 w-4"
								/>
								<span class="ml-2 text-sm text-surface-100">{formatExerciseType(type)}</span>
							</label>
						{/each}
					</div>
					{#if hasTypeError}
						<p class="mt-1 text-xs text-error-500">{fieldErrors.type?.[0]}</p>
					{/if}
				</div>

				<div class="lg:col-span-2">
					<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
						<div>
							<div class="mb-2 flex items-center justify-between">
								<label
									for="question"
									class="block text-xs font-semibold tracking-wide text-surface-300 uppercase"
								>
									Question <span class="text-error-600">*</span>
								</label>
								<span class="text-xs text-surface-500">{questionLength}/{questionMaxLength}</span>
							</div>
							<textarea
								id="question"
								name="question"
								bind:value={questionText}
								autocomplete="off"
								placeholder="What is the capital of France?"
								maxlength={questionMaxLength}
								rows="2"
								class={`w-full resize-none rounded border bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none ${hasQuestionError ? "border-error-600" : "border-surface-600"}`}
							></textarea>
							<div class="mt-1 flex items-center justify-between">
								<div>
									{#if hasQuestionError}
										<p class="text-xs text-error-500">{fieldErrors.question?.join(", ")}</p>
									{:else if questionLength < questionMinLength}
										<p class="text-xs text-surface-400">Min {questionMinLength} chars</p>
									{:else}
										<p class="text-xs text-success-500">✓</p>
									{/if}
								</div>
								{#if mode === "edit"}
									<button
										type="button"
										class="text-xs text-primary-500 hover:text-primary-400"
										onclick={() => {
											navigator.clipboard.writeText(
												questionText.replace(/{/g, "").replace(/}/g, "")
											);
											toastSuccess("Question copied to clipboard");
										}}>Copy</button
									>
								{/if}
							</div>
						</div>

						<div>
							<div class="mb-2 flex items-center justify-between">
								<label
									for="translation"
									class="block text-xs font-semibold tracking-wide text-surface-300 uppercase"
								>
									Question Translation
								</label>
								<span class="text-xs text-surface-500">{translationLength}/{translationMaxLength}</span>
							</div>
							<div class="relative">
								<textarea
									disabled={clearTranslation}
									id="translation"
									name="translation"
									bind:value={translationText}
									autocomplete="off"
									placeholder="translation"
									maxlength={translationMaxLength}
									rows="2"
									class="w-full resize-none rounded border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
								></textarea>
								{#if translationText || (mode === "edit" && exercise?.translation)}
									<Button
										icon
										IconComponent={X}
										useIcon
										preset="ghost"
										color="surface"
										class="absolute top-2 right-2"
										disabled={clearTranslation}
										title="Clear translation (set to null)"
										onclick={handleClearTranslation}
									/>
								{/if}
							</div>
							{#if clearTranslation}
								<p class="mt-1 text-xs text-warning-500">
									Translation will be removed
									<button
										type="button"
										onclick={handleUndoClearTranslation}
										class="ml-2 underline hover:text-warning-400">Undo</button
									>
								</p>
							{/if}
							{#if hasTranslationError}
								<p class="mt-1 text-xs text-error-500">{fieldErrors.translation?.[0]}</p>
							{/if}
						</div>
					</div>

					<hr class="my-4 border-surface-600" />

					<div>
						<label
							for="correctAnswer"
							class="mb-2 block text-xs font-semibold tracking-wide text-surface-300 uppercase"
						>
							Correct Answer <span class="text-error-600">*</span>
						</label>
						<input
							id="correctAnswer"
							type="text"
							name="correctAnswer"
							bind:value={correctAnswerText}
							autocomplete="off"
							placeholder="Paris"
							maxlength={answerMaxLength}
							class={`w-full rounded border bg-surface-800 px-3 py-2 text-sm text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none ${hasAnswerError ? "border-error-600" : "border-surface-600"}`}
						/>
						{#if hasAnswerError}
							<p class="mt-1 text-xs text-error-500">{fieldErrors.correctAnswer?.join(", ")}</p>
						{/if}
					</div>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div class="lg:col-span-1">
					<div class="mb-2 flex items-center justify-between">
						<label
							for="alternatives-input"
							class="block text-xs font-semibold tracking-wide text-surface-300 uppercase"
							>Alternatives (Optional)</label
						>
						{#if additionalCorrectAnswers.length > 0 || (mode === "edit" && exercise?.additionalCorrectAnswers?.length)}
							<button
								type="button"
								onclick={handleClearAdditionalAnswers}
								class="text-xs text-error-500 hover:text-error-400"
								title="Clear all alternatives">Clear all</button
							>
						{/if}
					</div>
					{#key tagsResetKey}
						<TagsInput
							disabled={canClearAdditionalAnswers}
							validate={handleValidateAdditionalAnswersInput}
							onValueChange={handleAdditionalAnswersChange}
							value={additionalCorrectAnswers.map((d) => d.value)}
						>
							<TagsInput.Control class="w-full">
								<TagsInput.Context>
									{#snippet children(tagsInput)}
										<div class="mb-2 flex flex-wrap gap-1">
											{#each tagsInput().value as value, index (index)}
												<TagsInput.Item {value} {index}>
													<TagsInput.ItemPreview
														class="gap-1 rounded border border-success-700 bg-success-900 px-1.5 py-0.5"
													>
														<span class="text-xs text-surface-100">{value}</span>
														<TagsInput.ItemDeleteTrigger
															class="cursor-pointer text-success-600 hover:text-success-500"
														/>
													</TagsInput.ItemPreview>
													<TagsInput.ItemInput />
												</TagsInput.Item>
											{/each}
										</div>
									{/snippet}
								</TagsInput.Context>
								<TagsInput.Input
									id="alternatives-input"
									placeholder="paris, PARIS, Île de France..."
									class="w-full rounded border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
								/>
							</TagsInput.Control>
							<TagsInput.HiddenInput />
						</TagsInput>
					{/key}
					{#if canClearAdditionalAnswers}
						<p class="mt-1 text-xs text-warning-500">
							All alternatives will be removed when you save
							<button
								type="button"
								onclick={handleUndoClearAdditionalAnswers}
								class="ml-2 underline hover:text-warning-400">Undo</button
							>
						</p>
					{:else}
						<p class="mt-1 text-xs text-surface-400">{additionalCorrectAnswers.length} added</p>
					{/if}
				</div>

				<div class="lg:col-span-2">
					<div class="mb-2 flex items-center justify-between">
						<label
							for="distractors-input"
							class="block text-xs font-semibold tracking-wide text-surface-300 uppercase"
							>Wrong Answers</label
						>
						{#if distractors.length > 0 || (mode === "edit" && exercise?.distractors?.length)}
							<button
								type="button"
								onclick={handleClearDistractors}
								class="text-xs text-error-500 hover:text-error-400"
								title="Clear all distractors">Clear all</button
							>
						{/if}
					</div>
					{#key tagsResetKey}
						<TagsInput
							disabled={canClearDistractors}
							validate={handleValidateDistractorsInput}
							onValueChange={handleDistractorsChange}
							value={distractors.map((d) => d.value)}
						>
							<TagsInput.Control class="w-full">
								<TagsInput.Context>
									{#snippet children(tagsInput)}
										<div class="mb-2 flex flex-wrap gap-1">
											{#each tagsInput().value as value, index (index)}
												<TagsInput.Item {value} {index} id={value + index}>
													<TagsInput.ItemPreview
														class="gap-1 rounded border border-error-700 bg-error-900 px-1.5 py-0.5"
													>
														<span class="text-xs text-surface-100">{value}</span>
														<TagsInput.ItemDeleteTrigger
															class="cursor-pointer text-error-600 hover:text-error-500"
														/>
													</TagsInput.ItemPreview>
													<TagsInput.ItemInput />
												</TagsInput.Item>
											{/each}
										</div>
									{/snippet}
								</TagsInput.Context>
								<TagsInput.Input
									id="distractors-input"
									placeholder="london, berlin, madrid..."
									class="w-full rounded border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
								/>
							</TagsInput.Control>
							<TagsInput.HiddenInput />
						</TagsInput>
					{/key}
					{#if canClearDistractors}
						<p class="mt-1 text-xs text-warning-500">
							All distractors will be removed when you save
							<button
								type="button"
								onclick={handleUndoClearDistractors}
								class="ml-2 underline hover:text-warning-400">Undo</button
							>
						</p>
					{:else}
						<p class="mt-1 text-xs text-surface-400">{distractors.length} added</p>
					{/if}
				</div>
			</div>

			<details
				class="border-t border-surface-700 pt-4"
				open={Boolean(explanationText || clearExplanation || (mode === "edit" && exercise?.explanation))}
			>
				<summary
					class="cursor-pointer text-xs font-semibold tracking-wide text-surface-300 uppercase hover:text-surface-200"
					>+ Explanation (Optional)</summary
				>
				<div class="mt-3">
					<div class="relative">
						<textarea
							disabled={clearExplanation}
							id="explanation"
							name="explanation"
							bind:value={explanationText}
							placeholder="Why is this the correct answer?"
							rows="3"
							class="w-full resize-none rounded border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-800 px-3 py-2 text-sm text-surface-900 dark:text-surface-100 placeholder-surface-500 focus:border-transparent focus:ring-2 focus:ring-primary-500 focus:outline-none"
						></textarea>
						{#if explanationText || (mode === "edit" && exercise?.explanation)}
							<Button
								icon
								IconComponent={X}
								useIcon
								preset="ghost"
								color="surface"
								class="absolute top-2 right-2"
								disabled={clearExplanation}
								onclick={handleClearExplanation}
								title="Clear explanation (set to null)"
							></Button>
						{/if}
					</div>
					{#if clearExplanation}
						<p class="mt-1 text-xs text-warning-500">
							Explanation will be removed when you save
							<button
								type="button"
								onclick={handleUndoClearExplanation}
								class="ml-2 underline hover:text-warning-400">Undo</button
							>
						</p>
					{/if}
					{#if hasExplanationError}
						<p class="mt-1 text-xs text-error-500">{fieldErrors.explanation?.[0]}</p>
					{/if}
				</div>
			</details>

			<details class="border-t border-surface-700 pt-4">
				<summary
					class="cursor-pointer text-xs font-semibold tracking-wide text-surface-300 uppercase hover:text-surface-200"
					>+ Media Files (Optional)</summary
				>
				<div class="mt-3">
					<MediaField imageUrl={exercise?.imageUrl} audioUrl={exercise?.audioUrl} />
				</div>
			</details>

			<div class="mt-6 flex items-center justify-between gap-2 border-t border-surface-700 pt-4">
				<div class="text-xs text-surface-400">
					{#if hasQuestionError || hasAnswerError || hasTypeError}
						<span class="font-medium text-error-500">Please fix errors</span>
					{:else if questionLength >= questionMinLength && correctAnswerText}
						<span class="font-medium text-success-500">Ready ✓</span>
					{:else}
						<span>Fill required fields</span>
					{/if}
				</div>
				<div class="flex gap-2">
					<Button
						text={submitButtonText}
						type="submit"
						color="primary"
						size="sm"
						disabled={questionLength < questionMinLength || submitting}
						loading={submitting}
					/>
					<Button
						text="Cancel"
						type="button"
						color="secondary"
						preset="outlined"
						size="sm"
						onclick={onCancel}
					/>
				</div>
			</div>
		</form>
	</div>
</div>

<style>
	details summary {
		user-select: none;
	}
	details summary::-webkit-details-marker {
		display: none;
	}
</style>
