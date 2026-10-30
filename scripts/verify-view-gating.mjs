// scripts/verify-view-gating.mjs
//
// Verifies that due endpoints are gated by drill access (STUDY+), not just
// read access. Self-contained: creates temp VIEW + STUDY users, grants
// shares on the given collection, tests, then revokes + deletes.
//
// Usage:
//   node scripts/verify-view-gating.mjs <adminEmail> <adminPassword> <collectionId>

const BASE = process.env.ARETE_BASE_URL || "http://localhost:3000";

const [adminEmail, adminPassword, collectionId] = process.argv.slice(2);
if (!adminEmail || !adminPassword || !collectionId) {
	console.error("Usage: node scripts/verify-view-gating.mjs <adminEmail> <adminPassword> <collectionId>");
	process.exit(1);
}

const ts = Date.now();
const VIEW_EMAIL = `verify-view-${ts}@test.local`;
const STUDY_EMAIL = `verify-study-${ts}@test.local`;
const PW = `Ver1fy-${ts}!`;

const failures = [];

function section(s) {
	console.log(`\n── ${s} ${"─".repeat(Math.max(0, 52 - s.length))}`);
}
function ok(s) {
	console.log(`  ✅ ${s}`);
}
function fail(s) {
	console.log(`  ❌ ${s}`);
	failures.push(s);
}
function info(s) {
	console.log(`     ${s}`);
}

class Client {
	constructor(name) {
		this.name = name;
		this.cookie = "";
	}
	async req(method, path, body) {
		const headers = {
			"Content-Type": "application/json",
			// better-auth CSRF check on mutations (POST/PATCH/DELETE):
			// Origin must be in trustedOrigins. localhost:3000 is.
			Origin: BASE,
		};
		if (this.cookie) headers.Cookie = this.cookie;
		const res = await fetch(`${BASE}${path}`, {
			method,
			headers,
			body: body !== undefined ? JSON.stringify(body) : undefined,
			redirect: "manual",
		});
		const setCookies = res.headers.getSetCookie?.() ?? [];
		if (setCookies.length) {
			this.cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
		}
		return res;
	}
	async json(method, path, body) {
		const res = await this.req(method, path, body);
		const text = await res.text();
		let parsed;
		try {
			parsed = JSON.parse(text);
		} catch {
			parsed = text;
		}
		return { status: res.status, body: parsed };
	}
	async signIn(email, password) {
		const res = await this.json("POST", "/api/auth/sign-in/email", { email, password });
		if (res.status !== 200) {
			throw new Error(`sign-in failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
		}
	}
	async signOut() {
		if (this.cookie) await this.json("POST", "/api/auth/sign-out", {});
		this.cookie = "";
	}
}

async function main() {
	const admin = new Client("admin");

	console.log(`→ Signing in as admin (${adminEmail}) at ${BASE}…`);
	await admin.signIn(adminEmail, adminPassword);
	ok("Admin signed in");

	// Sanity: admin can see the collection
	const probe = await admin.json("GET", `/collections/get_by_id/${collectionId}`);
	if (probe.status !== 200) {
		throw new Error(`admin cannot read collection ${collectionId}: ${probe.status} ${JSON.stringify(probe.body)}`);
	}
	info(`Collection: ${probe.body.name ?? "(unnamed)"} (${collectionId})`);

	// ── Setup: temp users ──────────────────────────────────────────────
	section("Setup — create temp users");
	const created = {};
	for (const [kind, email] of [
		["VIEW", VIEW_EMAIL],
		["STUDY", STUDY_EMAIL],
	]) {
		const res = await admin.json("POST", "/admin/users", {
			name: `Verify ${kind} ${ts}`,
			email,
			password: PW,
			role: "USER",
		});
		if (res.status !== 200 && res.status !== 201) {
			throw new Error(`create ${kind} user failed: ${res.status} ${JSON.stringify(res.body)}`);
		}
		created[kind] = { id: res.body.user.id, email };
		ok(`Created ${kind} user ${email} (id=${created[kind].id})`);
	}

	// ── Setup: grants ──────────────────────────────────────────────────
	section("Setup — grant shares");
	for (const [kind, level] of [
		["VIEW", "VIEW"],
		["STUDY", "STUDY"],
	]) {
		const res = await admin.json("POST", `/admin/collections/${collectionId}/access`, {
			userId: created[kind].id,
			accessLevel: level,
		});
		if (res.status !== 200 && res.status !== 201) {
			throw new Error(`grant ${level} to ${kind} failed: ${res.status} ${JSON.stringify(res.body)}`);
		}
		ok(`Granted ${level} to ${created[kind].email}`);
	}

	// ── Tests ──────────────────────────────────────────────────────────
	for (const kind of ["VIEW", "STUDY"]) {
		section(`Test as ${kind} user (${created[kind].email})`);
		const c = new Client(kind);
		await c.signIn(created[kind].email, PW);

		// /exercises/due-count?collectionId=X
		const dc = await c.json("GET", `/exercises/due-count?collectionId=${collectionId}`);
		info(`GET /exercises/due-count?collectionId=… → ${dc.status} ${JSON.stringify(dc.body)}`);
		if (kind === "VIEW") {
			if (dc.status === 200 && dc.body?.count === 0) ok("due-count returns { count: 0 } for VIEW");
			else fail(`due-count should be { count: 0 } for VIEW, got ${dc.status} ${JSON.stringify(dc.body)}`);
		} else {
			if (dc.status === 200 && typeof dc.body?.count === "number")
				ok(`due-count returns numeric count (${dc.body.count}) for STUDY`);
			else
				fail(
					`due-count should return { count: number } for STUDY, got ${dc.status} ${JSON.stringify(dc.body)}`
				);
		}

		// /exercises/due/:collectionId
		const due = await c.req("GET", `/exercises/due/${collectionId}?limit=10`);
		info(`GET /exercises/due/:collectionId → ${due.status}`);
		if (kind === "VIEW") {
			if (due.status === 403) ok("due/:id returns 403 for VIEW (answer leak closed)");
			else fail(`due/:id should 403 for VIEW, got ${due.status}`);
		} else {
			if (due.status === 200) ok("due/:id returns 200 for STUDY");
			else fail(`due/:id should 200 for STUDY, got ${due.status}`);
		}

		await c.signOut();
	}

	// ── Cleanup ────────────────────────────────────────────────────────
	section("Cleanup");
	if (!admin.cookie) await admin.signIn(adminEmail, adminPassword);
	for (const kind of ["VIEW", "STUDY"]) {
		const revoke = await admin.json("DELETE", `/admin/collections/${collectionId}/access/${created[kind].id}`);
		if (revoke.status === 200 || revoke.status === 204) ok(`Revoked share for ${kind}`);
		else info(`revoke ${kind}: ${revoke.status} (likely cascade-only)`);

		const del = await admin.json("DELETE", `/admin/users/${created[kind].id}`);
		if (del.status === 200 || del.status === 204) ok(`Deleted ${kind} user`);
		else fail(`delete ${kind} user: ${del.status} ${JSON.stringify(del.body)}`);
	}

	// ── Report ─────────────────────────────────────────────────────────
	section("Result");
	if (failures.length === 0) {
		console.log("✅ All checks passed.");
		process.exit(0);
	}
	console.log(`❌ ${failures.length} check(s) failed:`);
	for (const f of failures) console.log(`   - ${f}`);
	process.exit(1);
}

main().catch((e) => {
	console.error(`\n❌ Fatal: ${e.message}`);
	process.exit(1);
});
