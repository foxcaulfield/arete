export interface FilterPreset {
	id: string;
	label: string;
	params: Record<string, string>;
}

export const COLLECTION_SORT_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "updatedAt:desc", label: "Recently updated" },
	{ value: "updatedAt:asc", label: "Oldest updated" },
	{ value: "createdAt:desc", label: "Newest created" },
	{ value: "name:asc", label: "Name A → Z" },
	{ value: "name:desc", label: "Name Z → A" },
];

export const COLLECTION_PRESETS: FilterPreset[] = [];

export const EXERCISE_PRESETS: FilterPreset[] = [
	// — Reset / filters —
	{ id: "all", label: "All", params: {} },
	{ id: "audio", label: "Has audio", params: { hasAudio: "has" } },
	{ id: "no-audio", label: "No audio", params: { hasAudio: "none" } },
	{ id: "image", label: "Has image", params: { hasImage: "has" } },
	{ id: "no-image", label: "No image", params: { hasImage: "none" } },
	{ id: "no-media", label: "No media", params: { hasAudio: "none", hasImage: "none" } },
	{ id: "fill", label: "Fill-in-the-blank", params: { type: "FILL_IN_THE_BLANK" } },
	{ id: "choice", label: "Choice single", params: { type: "CHOICE_SINGLE" } },
	// — Sorts —
	{ id: "most-attempted", label: "Most attempted", params: { sortBy: "totalAttempts", sortOrder: "desc" } },
	{ id: "least-attempted", label: "Least attempted", params: { sortBy: "totalAttempts", sortOrder: "asc" } },
	{ id: "hardest", label: "Hardest", params: { sortBy: "mostFailed", sortOrder: "desc" } },
];

export const EXERCISE_SORT_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "updatedAt:desc", label: "Recently updated" },
	{ value: "createdAt:desc", label: "Newest created" },
	{ value: "question:asc", label: "Question A → Z" },
	{ value: "totalAttempts:desc", label: "Most attempted" },
	{ value: "totalAttempts:asc", label: "Least attempted" },
	{ value: "mostFailed:desc", label: "Hardest (most failed)" },
];

/**
 * Determines which preset (if any) is "active" given current URL params.
 * A preset is active when:
 *   1. every key/value in its `params` matches the effective URL value
 *      (URL value falls back to the per-key default when not present), and
 *   2. every key in `defaults` that is NOT part of the preset's params
 *      still holds its default value (or is absent from the URL).
 *
 * The fallback to `defaults` in step 1 is what makes
 * `sortBy=totalAttempts` (with implicit sortOrder=desc) correctly match the
 * `most-attempted` preset — sortOrder is absent from the URL, but its
 * effective value is "desc", which matches the preset.
 */
export function activePresetId(
	presets: FilterPreset[],
	urlParams: URLSearchParams,
	defaults: Record<string, string>
): string | null {
	for (const p of presets) {
		const keys = Object.keys(p.params);
		if (keys.length === 0) continue;

		const allMatch = keys.every((k): boolean => {
			const effective = urlParams.get(k) ?? defaults[k] ?? "";
			return effective === p.params[k];
		});
		if (!allMatch) continue;

		const allOthersDefault = Object.keys(defaults).every((k): boolean => {
			if (keys.includes(k)) return true;
			const effective = urlParams.get(k) ?? defaults[k];
			return effective === defaults[k];
		});
		if (allOthersDefault) return p.id;
	}
	return null;
}
