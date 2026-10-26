import type { Component } from "svelte";

export type RouteComponent = Component<any>;

interface PageState {
	url: URL;
	path: string;
	params: Record<string, string>;
	error: { status: number; message: string } | null;
	status: number;
}

class Router {
	public path = $state("/");
	public error = $state<{ status: number; message: string } | null>(null);
	public status = $state(200);
	public url = $state(new URL(window.location.href));

	// In prod, SPA is served under /app/* by ServeStaticModule.
	// In dev, Vite serves it at /*. This makes the router transparent to both.
	private readonly basePath = import.meta.env.PROD ? "/app" : "";

	private routes = new Map<string, RouteComponent>();
	private notFound: RouteComponent | null = null;

	public constructor() {
		window.addEventListener("popstate", () => this.syncFromLocation());
		this.syncFromLocation();
	}

	private stripBase(path: string): string {
		if (!this.basePath) return path;
		if (path === this.basePath || path === this.basePath + "/") return "/";
		if (path.startsWith(this.basePath + "/")) return path.slice(this.basePath.length);
		return path;
	}

	private withBase(path: string): string {
		if (!this.basePath) return path;
		if (path.startsWith(this.basePath)) return path;
		return this.basePath + path;
	}

	public register(pattern: string, component: RouteComponent): void {
		this.routes.set(pattern, component);
	}

	public registerNotFound(component: RouteComponent): void {
		this.notFound = component;
	}

	public navigate(to: string): void {
		const full = this.withBase(to);
		const current = window.location.pathname + window.location.search + window.location.hash;
		if (full === current) return;
		window.history.pushState({}, "", full);
		this.syncFromLocation();
	}

	public replace(to: string): void {
		const full = this.withBase(to);
		const current = window.location.pathname + window.location.search + window.location.hash;
		if (full === current) return;
		window.history.replaceState({}, "", full);
		this.syncFromLocation();
	}

	public setError(status: number, message: string): void {
		this.error = { status, message };
		this.status = status;
	}

	public clearError(): void {
		this.error = null;
		this.status = 200;
	}

	public resolve(): { component: RouteComponent; params: Record<string, string> } | null {
		const exact = this.routes.get(this.path);
		if (exact) return { component: exact, params: {} };

		for (const [pattern, component] of this.routes.entries()) {
			const params = this.matchDynamic(pattern, this.path);
			if (params) return { component, params };
		}

		if (this.notFound) return { component: this.notFound, params: {} };
		return null;
	}

	public get page(): PageState {
		const match = this.resolve();
		return {
			url: this.url,
			path: this.path,
			params: match?.params ?? {},
			error: this.error,
			status: this.status,
		};
	}

	private syncFromLocation(): void {
		this.path = this.stripBase(window.location.pathname);
		this.url = new URL(window.location.href);
	}

	private matchDynamic(pattern: string, path: string): Record<string, string> | null {
		const pParts = pattern.split("/").filter(Boolean);
		const aParts = path.split("/").filter(Boolean);
		if (pParts.length !== aParts.length) return null;

		const params: Record<string, string> = {};
		for (let i = 0; i < pParts.length; i++) {
			const p = pParts[i];
			const a = aParts[i];
			if (!p || !a) return null;
			if (p.startsWith(":")) {
				params[p.slice(1)] = decodeURIComponent(a);
			} else if (p !== a) {
				return null;
			}
		}
		return params;
	}
}

export const router = new Router();
