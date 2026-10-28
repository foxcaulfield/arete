import { defineConfig, searchForWorkspaceRoot } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import type { IncomingMessage } from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND = "http://localhost:3000";

function pageOrApi(req: IncomingMessage): string | null {
	const accept = (req.headers.accept ?? "").toString();
	if (accept.includes("text/html")) return "/index.html";
	return null;
}

export default defineConfig({
	root: __dirname,
	// Dev: assets at "/". Prod (vite build): assets at "/app/" so ServeStaticModule serves them.
	base: process.env.NODE_ENV === "production" ? "/app/" : "/",
	plugins: [tailwindcss(), svelte()],
	resolve: {
		alias: {
			$lib: resolve(__dirname, "src/lib"),
			"@shared": resolve(__dirname, "../shared"),
		},
	},
	server: {
		port: 5173,
		fs: { allow: [searchForWorkspaceRoot(process.cwd())] },
		proxy: {
			"/api": BACKEND,
			"/me": BACKEND,
			"/admin": { target: BACKEND, bypass: pageOrApi },
			"/users": { target: BACKEND, bypass: pageOrApi },
			"/collections": { target: BACKEND, bypass: pageOrApi },
			"/exercises": { target: BACKEND, bypass: pageOrApi },
		},
	},
	build: {
		outDir: resolve(__dirname, "../public/app"),
		emptyOutDir: true,
	},
});
