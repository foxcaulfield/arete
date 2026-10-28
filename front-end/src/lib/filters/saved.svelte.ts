export interface SavedFilter {
	id: string;
	name: string;
	query: string; // e.g. "search=paris&type=CHOICE_SINGLE&hasImage=has"
}

const MAX_SAVED = 30;

function loadFromStorage(key: string): SavedFilter[] {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(x): x is SavedFilter =>
				typeof x === "object" &&
				x !== null &&
				typeof (x as SavedFilter).id === "string" &&
				typeof (x as SavedFilter).name === "string" &&
				typeof (x as SavedFilter).query === "string"
		);
	} catch {
		return [];
	}
}

function persist(key: string, items: SavedFilter[]): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(key, JSON.stringify(items));
	} catch {
		/* quota or blocked — silently ignore */
	}
}

export interface SavedFiltersStore {
	readonly items: SavedFilter[];
	add(name: string, query: string): void;
	remove(id: string): void;
}

export function makeSavedFilters(storageKey: string): SavedFiltersStore {
	const initial = loadFromStorage(storageKey);
	const items = $state<SavedFilter[]>(initial);

	return {
		get items(): SavedFilter[] {
			return items;
		},
		add(name: string, query: string): void {
			const trimmed = name.trim();
			if (!trimmed) return;
			if (items.some((x): boolean => x.name === trimmed && x.query === query)) return;
			const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
			items.push({ id, name: trimmed, query });
			if (items.length > MAX_SAVED) items.splice(0, items.length - MAX_SAVED);
			persist(storageKey, items);
		},
		remove(id: string): void {
			const idx = items.findIndex((x): boolean => x.id === id);
			if (idx >= 0) {
				items.splice(idx, 1);
				persist(storageKey, items);
			}
		},
	};
}
