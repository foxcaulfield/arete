#!/usr/bin/env node
// Usage: node scripts/verify-admin.mjs [email] [password]
// Defaults: admin@admin.com / <asks if not provided>
//
// Verifies admin endpoints work end-to-end against a running dev backend.
// Logs in via the public /api/auth/sign-in/email endpoint, then hits every
// admin route with the resulting session cookies.

const BASE = process.env.API_URL || "http://localhost:3000";
const ORIGIN = process.env.TRUSTED_ORIGIN || "http://localhost:3000";

const email = process.argv[2] || "admin@admin.com";
const password = process.argv[3];

if (!password) {
	console.error("Usage: node scripts/verify-admin.mjs <email> <password>");
	console.error("  e.g. node scripts/verify-admin.mjs admin@admin.com mypass123");
	process.exit(1);
}

async function signIn() {
	const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: ORIGIN },
		body: JSON.stringify({ email, password }),
	});
	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Sign-in failed (${res.status}): ${body}`);
	}
	const cookies = res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
	if (!cookies) throw new Error("Sign-in succeeded but returned no Set-Cookie headers");
	return cookies;
}

async function hit(cookies, method, path, body) {
	const opts = {
		method,
		headers: {
			Cookie: cookies,
			Origin: ORIGIN,
			...(body ? { "Content-Type": "application/json" } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	};
	const res = await fetch(`${BASE}${path}`, opts);
	const text = await res.text();
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		parsed = text;
	}
	return { status: res.status, body: parsed };
}

function statusIcon(code) {
	if (code >= 200 && code < 300) return "✅";
	if (code === 401) return "🔒";
	if (code === 403) return "🚫";
	if (code === 404) return "❓";
	return "❌";
}

async function main() {
	console.log(`→ Signing in as ${email} at ${BASE}…`);
	const cookies = await signIn();
	console.log("✅ Signed in\n");

	// First, get a real collection ID to test admin/collections/:id/access
	const colls = await hit(cookies, "GET", "/collections/list?limit=1");
	const collectionId = colls.body?.data?.[0]?.id;
	const me = await hit(cookies, "GET", "/me");
	const userId = me.body?.id;

	console.log(`  caller: ${me.body?.email ?? "?"} (${userId ?? "?"})`);
	console.log(`  collection: ${collectionId ?? "(none — skip the /access check)"}\n`);

	const checks = [
		{ method: "GET", path: "/me", label: "GET /me" },
		{ method: "GET", path: "/collections/list?limit=2", label: "GET /collections/list" },
		{ method: "GET", path: "/collections/shared?limit=2", label: "GET /collections/shared" },
		{ method: "GET", path: "/admin/users?limit=2", label: "GET /admin/users" },
		{
			method: "GET",
			path: "/admin/users?search=admin",
			label: "GET /admin/users?search=admin",
		},
		...(userId
			? [{ method: "GET", path: `/admin/users/${userId}/access`, label: `GET /admin/users/:id/access` }]
			: []),
		...(collectionId
			? [
					{
						method: "GET",
						path: `/admin/collections/${collectionId}/access`,
						label: "GET /admin/collections/:id/access",
					},
				]
			: []),
	];

	console.log("── Admin endpoints ──────────────────────────────────────");
	let failed = 0;
	for (const c of checks) {
		const res = await hit(cookies, c.method, c.path);
		const expected2xx = res.status >= 200 && res.status < 300;
		if (!expected2xx) failed++;
		const preview =
			typeof res.body === "object" ? JSON.stringify(res.body).slice(0, 80) : String(res.body).slice(0, 80);
		console.log(`  ${statusIcon(res.status)} ${res.status}  ${c.label}`);
		console.log(`     ${preview}`);
	}

	console.log("\n── Negative tests (should reject) ──────────────────────");
	const negChecks = [
		{
			label: "unauthenticated /admin/users → 401 or 403",
			fn: async () => {
				const res = await fetch(`${BASE}/admin/users`, { headers: { Origin: ORIGIN } });
				return res.status;
			},
			expect: (s) => s === 401 || s === 403,
		},
	];
	for (const n of negChecks) {
		const status = await n.fn();
		const ok = n.expect(status);
		if (!ok) failed++;
		console.log(`  ${statusIcon(status)} ${status}  ${n.label}`);
	}

	console.log("\n" + (failed === 0 ? "✅ All checks passed." : `❌ ${failed} check(s) failed.`));
	process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error("❌", e.message);
	process.exit(1);
});
