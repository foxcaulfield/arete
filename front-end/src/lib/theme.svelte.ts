// Theme switcher store. Persists to localStorage and applies
// data-theme on <html>. The inline <head> script in index.html
// applies the stored theme before first paint; init() here just
// syncs the reactive value so the ProfilePage selector shows the
// correct active option.

const STORAGE_KEY = "arete:theme";

export interface ThemeOption {
	value: string;
	label: string;
}

export const SKELETON_THEMES: ThemeOption[] = [
	{ value: "catppuccin", label: "Catppuccin" },
	{ value: "cerberus", label: "Cerberus" },
	{ value: "concord", label: "Concord" },
	{ value: "crimson", label: "Crimson" },
	{ value: "dracula", label: "Dracula" },
	{ value: "fennec", label: "Fennec" },
	{ value: "hamlindigo", label: "Hamlindigo" },
	{ value: "legacy", label: "Legacy" },
	{ value: "mint", label: "Mint" },
	{ value: "modern", label: "Modern" },
	{ value: "mona", label: "Mona" },
	{ value: "nosh", label: "Nosh" },
	{ value: "nouveau", label: "Nouveau" },
	{ value: "pine", label: "Pine" },
	{ value: "reign", label: "Reign" },
	{ value: "rocket", label: "Rocket" },
	{ value: "rose", label: "Rose" },
	{ value: "rosepine", label: "Rosé Pine" },
	{ value: "sahara", label: "Sahara" },
	{ value: "seafoam", label: "Seafoam" },
	{ value: "terminus", label: "Terminus" },
	{ value: "vintage", label: "Vintage" },
	{ value: "vox", label: "Vox" },
	{ value: "wintry", label: "Wintry" },
];

export const CUSTOM_THEMES: ThemeOption[] = [
	{ value: "near-monochrome", label: "Near Monochrome" },
	{ value: "ink-stone", label: "Ink Stone" },
	{ value: "nouveau-two", label: "Nouveau 2" },
	{ value: "rose-nouveau", label: "Rose Nouveau" },
	{ value: "newspaper", label: "Newspaper" },
];

export const THEME_GROUPS: Array<{ label: string; items: ThemeOption[] }> = [
	{ label: "Skeleton themes", items: SKELETON_THEMES },
	{ label: "Custom themes", items: CUSTOM_THEMES },
];

const ALL_THEMES = [...SKELETON_THEMES, ...CUSTOM_THEMES];
const DEFAULT_THEME = "crimson";

function isValidTheme(v: string | null | undefined): v is string {
	return !!v && ALL_THEMES.some((t): boolean => t.value === v);
}

class ThemeStore {
	public current = $state<string>(DEFAULT_THEME);

	public init(): void {
		// Prefer the DOM value — set by the inline <head> script, so it
		// already reflects localStorage with no flash.
		const fromDom = document.documentElement.dataset.theme;
		if (isValidTheme(fromDom)) {
			this.current = fromDom;
			return;
		}
		// Fallback (no <head> script or stale markup) — read storage directly.
		const stored = localStorage.getItem(STORAGE_KEY);
		if (isValidTheme(stored)) {
			this.current = stored;
			this.apply(stored);
			return;
		}
		this.current = DEFAULT_THEME;
		this.apply(DEFAULT_THEME);
	}

	public set(id: string): void {
		if (!isValidTheme(id)) return;
		this.current = id;
		localStorage.setItem(STORAGE_KEY, id);
		this.apply(id);
	}

	private apply(id: string): void {
		document.documentElement.setAttribute("data-theme", id);
	}
}

export const theme = new ThemeStore();

/* ─── Mode (dark / light) ─────────────────────────────────────────── */

const MODE_KEY = "arete:mode";
const DEFAULT_MODE: Mode = "dark";

export type Mode = "dark" | "light";

function isValidMode(v: string | null | undefined): v is Mode {
	return v === "dark" || v === "light";
}

class ModeStore {
	public current = $state<Mode>(DEFAULT_MODE);

	public init(): void {
		const fromDom = document.documentElement.dataset.mode;
		if (isValidMode(fromDom)) {
			this.current = fromDom;
			return;
		}
		const stored = localStorage.getItem(MODE_KEY);
		if (isValidMode(stored)) {
			this.current = stored;
			this.apply(stored);
			return;
		}
		this.current = DEFAULT_MODE;
		this.apply(DEFAULT_MODE);
	}

	public set(m: Mode): void {
		this.current = m;
		localStorage.setItem(MODE_KEY, m);
		this.apply(m);
	}

	public toggle(): void {
		this.set(this.current === "dark" ? "light" : "dark");
	}

	private apply(m: Mode): void {
		document.documentElement.setAttribute("data-mode", m);
		// Belt-and-suspenders: some tooling checks for .dark class instead of
		// data-mode. Skeleton v3 uses data-mode natively; keeping both in sync
		// costs nothing and protects against version drift.
		document.documentElement.classList.toggle("dark", m === "dark");
	}
}

export const mode = new ModeStore();
