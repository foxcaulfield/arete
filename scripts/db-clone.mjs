// scripts/db-clone.mjs
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";

const direction = process.argv[2];
if (!["pg-to-sqlite", "sqlite-to-pg"].includes(direction)) {
	console.error("Usage: node scripts/db-clone.mjs <pg-to-sqlite|sqlite-to-pg>");
	process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: "inherit" });
const wipeSqlite = () => {
	for (const f of ["prisma/dev.db", "prisma/dev.db-journal", "prisma/dev.db-wal", "prisma/dev.db-shm"]) {
		if (existsSync(f)) unlinkSync(f);
	}
};

if (direction === "pg-to-sqlite") {
	// Wipe SQLite, then copy Postgres → SQLite
	wipeSqlite();
	run("node scripts/db-use.mjs postgres");
	run("node scripts/db-export.mjs");
	run("node scripts/db-use.mjs sqlite");
	run("node scripts/db-import.mjs");
} else {
	// DANGER: this overwrites Postgres. Use db:combine instead for a safe merge.
	console.error("❌ Direct clone to Postgres is disabled — use `npm run db:combine` instead.");
	console.error("   db:combine merges SQLite into Postgres without overwriting.");
	process.exit(1);
}

console.log(`\n✅ ${direction} complete — active DB matches the source.`);
