#!/usr/bin/env node
// scripts/db-combine.mjs
//
// Combines Postgres + SQLite in one command.
//
// Semantics: Postgres is the "home base". SQLite-only records are MERGED IN.
//            Records present in both (by ID) are SKIPPED — Postgres wins.
//            Records unique to Postgres stay untouched.
//
// Safe to run multiple times — merge mode skips existing IDs.
// Leaves the active DB on Postgres when finished.
//
// Steps:
//   1. Switch to Postgres, export → data/export-postgres.json (backup)
//   2. Switch to SQLite,   export → data/export-sqlite.json  (source)
//   3. Switch back to Postgres, import export-sqlite.json with --merge
//   4. Re-export Postgres → data/export-postgres-after.json  (verify)

import { execSync } from "node:child_process";
import { existsSync, readFileSync, copyFileSync, unlinkSync, mkdirSync } from "node:fs";

const log = (msg) => console.log(`\n▶ ${msg}`);
const ok = (msg) => console.log(`✅ ${msg}`);
const warn = (msg) => console.log(`⚠  ${msg}`);

function run(cmd) {
	try {
		execSync(cmd, { stdio: "inherit" });
	} catch {
		console.error(`\n❌ Command failed: ${cmd}`);
		console.error("   Recover with: npm run db:use:postgres");
		process.exit(1);
	}
}

function moveFile(src, dst) {
	mkdirSync("data", { recursive: true });
	if (existsSync(dst)) unlinkSync(dst);
	copyFileSync(src, dst);
	unlinkSync(src);
}

function countDump(path) {
	if (!existsSync(path)) return null;
	try {
		return JSON.parse(readFileSync(path, "utf-8")).counts;
	} catch {
		return null;
	}
}

function isAllZero(counts) {
	return counts && Object.values(counts).every((n) => n === 0);
}

// ── Step 1: export Postgres (backup) ────────────────────────────────
log("Step 1/4 — Switch to Postgres, export backup…");
run("node scripts/db-use.mjs postgres");
run("node scripts/db-export.mjs");
moveFile("data/export.json", "data/export-postgres.json");
const pgCounts = countDump("data/export-postgres.json");
ok(`Postgres backup saved (${JSON.stringify(pgCounts)})`);

// ── Step 2: export SQLite (source of merge) ─────────────────────────
log("Step 2/4 — Switch to SQLite, export source…");
run("node scripts/db-use.mjs sqlite");
run("node scripts/db-export.mjs");
moveFile("data/export.json", "data/export-sqlite.json");
const liteCounts = countDump("data/export-sqlite.json");
ok(`SQLite export saved (${JSON.stringify(liteCounts)})`);

// ── Early exit if SQLite is empty ───────────────────────────────────
if (isAllZero(liteCounts)) {
	warn("SQLite is empty — nothing to merge. Postgres was NOT modified.");
	run("node scripts/db-use.mjs postgres");
	process.exit(0);
}

// ── Step 3: switch back to Postgres, stage merge input ──────────────
log("Step 3/4 — Switch back to Postgres, stage merge input…");
run("node scripts/db-use.mjs postgres");
copyFileSync("data/export-sqlite.json", "data/export.json");

// ── Step 4: merge SQLite dump into Postgres ─────────────────────────
log("Step 4/4 — Merge SQLite → Postgres (merge mode)…");
run("node scripts/db-import.mjs --merge");

// ── Verify: re-export Postgres for the after-snapshot ───────────────
log("Verifying — re-exporting Postgres…");
run("node scripts/db-export.mjs");
moveFile("data/export.json", "data/export-postgres-after.json");
const afterCounts = countDump("data/export-postgres-after.json");

// ── Summary ─────────────────────────────────────────────────────────
const delta = {};
for (const k of Object.keys(afterCounts ?? {})) {
	const d = (afterCounts[k] ?? 0) - (pgCounts?.[k] ?? 0);
	if (d !== 0) delta[k] = d > 0 ? `+${d}` : String(d);
}

console.log("\n═══════════════════════════════════════════════════════════");
console.log("  Combine complete — active DB is Postgres");
console.log("═══════════════════════════════════════════════════════════");
console.log(`  Before:  ${JSON.stringify(pgCounts)}`);
console.log(`  After:   ${JSON.stringify(afterCounts)}`);
console.log(`  Delta:   ${Object.keys(delta).length ? JSON.stringify(delta) : "(no changes)"}`);
console.log("");
console.log("  Dumps saved:");
console.log("    data/export-postgres.json        (backup, pre-merge)");
console.log("    data/export-sqlite.json          (source, merged in)");
console.log("    data/export-postgres-after.json  (post-merge snapshot)");
console.log("");
console.log("  Restart the backend to pick up the combined data:");
console.log("    npm run start:prod");
console.log("═══════════════════════════════════════════════════════════\n");
