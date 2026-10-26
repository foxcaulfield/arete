// Usage: npm run db:export
// Exports the ACTIVE database (whichever db:use:* selected) to data/export.json.

import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";

const prisma = new PrismaClient();
const OUTPUT_DIR = "data";
const OUTPUT_FILE = `${OUTPUT_DIR}/export.json`;

async function main() {
	const source = process.env.DB_PROVIDER || "postgres";
	console.log(`→ Exporting from ${source}…`);

	const [permissions, users, sessions, accounts, verifications, collections, exercises, attempts, collectionShares] =
		await Promise.all([
			prisma.permissions.findMany(),
			prisma.user.findMany({ include: { permissions: { select: { name: true } } } }),
			prisma.session.findMany(),
			prisma.account.findMany(),
			prisma.verification.findMany(),
			prisma.collection.findMany(),
			prisma.exercise.findMany(),
			prisma.attempt.findMany(),
			prisma.collectionShare.findMany(),
		]);

	const dump = {
		version: 1,
		exportedAt: new Date().toISOString(),
		sourceProvider: source,
		counts: {
			permissions: permissions.length,
			users: users.length,
			sessions: sessions.length,
			accounts: accounts.length,
			verifications: verifications.length,
			collections: collections.length,
			exercises: exercises.length,
			attempts: attempts.length,
			collectionShares: collectionShares.length,
		},
		data: {
			permissions,
			users,
			sessions,
			accounts,
			verifications,
			collections,
			exercises,
			attempts,
			collectionShares,
		},
	};

	mkdirSync(OUTPUT_DIR, { recursive: true });
	writeFileSync(OUTPUT_FILE, JSON.stringify(dump, null, 2));
	console.log(`✅ Exported to ${OUTPUT_FILE}`);
	console.log("   ", dump.counts);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
