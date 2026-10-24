// scripts/db-use.js
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const provider = process.argv[2];
if (!["postgres", "sqlite"].includes(provider)) {
	console.error("Usage: node scripts/db-use.js <postgres|sqlite>");
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

// 1. Copy the matching template into the active schema file
// const template = `prisma/templates/schema.${provider}.prisma`;
const template = `prisma/templates/schema.${provider}.prisma.tpl`;
copyFileSync(template, "prisma/schema.prisma");
console.log(`→ Copied ${template} → prisma/schema.prisma`);

// 2. Update .env
let updated = setEnv(envContent, "DB_PROVIDER", provider);
updated = setEnv(updated, "DATABASE_URL", url);
writeFileSync(ENV_PATH, updated);

// 3. Regenerate Prisma client
console.log(`→ Regenerating Prisma client for ${provider}…`);
execSync("npx prisma generate", { stdio: "inherit" });

// 4. For SQLite, sync schema (no migrations); for Postgres, remind about migrations
if (provider === "sqlite") {
	console.log("→ Syncing SQLite schema (db push)…");
	execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
} else {
	console.log("ℹ  Run `npx prisma migrate deploy` when you're ready to apply migrations.");
}

console.log(`✅ Switched to ${provider}. Restart your app.`);
