import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { transformToSqlite } from "./schema-transform.mjs";

const POSTGRES_TPL = "prisma/templates/schema.postgres.prisma.tpl";
const SQLITE_TPL = "prisma/templates/schema.sqlite.prisma.tpl";
const ACTIVE = "prisma/schema.prisma";

const provider = process.argv[2];
if (!["postgres", "sqlite"].includes(provider)) {
	console.error("Usage: node scripts/db-use.mjs <postgres|sqlite>");
	process.exit(1);
}

const ENV_PATH = resolve(".env");
const envContent = readFileSync(ENV_PATH, "utf-8");

function readEnv(key) {
	const m = envContent.match(new RegExp(`^${key}=(.+)$`, "m"));
	return m ? m[1].trim() : null;
}
function setEnv(content, key, value) {
	const regex = new RegExp(`^${key}=.*$`, "m");
	if (regex.test(content)) return content.replace(regex, `${key}=${value}`);
	return content.replace(/\s*$/, "") + `\n${key}=${value}\n`;
}

const url = provider === "sqlite" ? readEnv("DATABASE_URL_SQLITE") : readEnv("DATABASE_URL_POSTGRES");
if (!url) {
	console.error(`Missing DATABASE_URL_${provider.toUpperCase()} in .env`);
	process.exit(1);
}

// 1. Materialize the active schema
if (provider === "sqlite") {
	const pgTpl = readFileSync(POSTGRES_TPL, "utf-8");
	const sqliteTpl = transformToSqlite(pgTpl);
	writeFileSync(SQLITE_TPL, sqliteTpl); // gitignored — kept for inspection
	writeFileSync(ACTIVE, sqliteTpl);
	console.log(`→ Derived ${POSTGRES_TPL} → ${SQLITE_TPL} (transform)`);
	console.log(`→ Wrote ${SQLITE_TPL} → ${ACTIVE}`);
} else {
	copyFileSync(POSTGRES_TPL, ACTIVE);
	console.log(`→ Copied ${POSTGRES_TPL} → ${ACTIVE}`);
}

// 2. Update .env (unchanged)
let updated = setEnv(envContent, "DB_PROVIDER", provider);
updated = setEnv(updated, "DATABASE_URL", url);
writeFileSync(ENV_PATH, updated);

// 3. Regenerate Prisma client (unchanged)
console.log(`→ Regenerating Prisma client for ${provider}…`);
execSync("npx prisma generate", { stdio: "inherit" });

// 4. SQLite sync vs Postgres migrate reminder (unchanged)
if (provider === "sqlite") {
	console.log("→ Syncing SQLite schema (db push)…");
	execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
} else {
	console.log("ℹ  Run `npx prisma migrate deploy` when you're ready to apply migrations.");
}

console.log(`✅ Switched to ${provider}. Restart your app.`);
