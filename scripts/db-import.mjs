// Usage: npm run db:import       (strict — fails on any conflict)
//        npm run db:import:merge (merge — skips records that already exist)
// Imports data/export.json into the ACTIVE database.

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const INPUT_FILE = "data/export.json";
const MERGE = process.argv.includes("--merge");
const prisma = new PrismaClient();

const toDate = (v) => (typeof v === "string" ? new Date(v) : v);

async function main() {
	const dump = JSON.parse(readFileSync(INPUT_FILE, "utf-8"));
	if (dump.version !== 1) throw new Error(`Unsupported dump version ${dump.version}`);

	const target = process.env.DB_PROVIDER || "postgres";
	console.log(`→ Importing ${INPUT_FILE} (v${dump.version}, from ${dump.sourceProvider}) into ${target}`);
	console.log(`   Mode: ${MERGE ? "MERGE (skip existing)" : "STRICT (fail on conflict)"}`);

	const inserted = {};
	const skipped = {};
	const warn = (msg) => console.warn(`   ⚠  ${msg}`);
	const bump = (bucket, key) => {
		bucket[key] = (bucket[key] ?? 0) + 1;
	};

	// 1. Permissions (needed before user↔permission junction)
	for (const p of dump.data.permissions) {
		if (await prisma.permissions.findUnique({ where: { name: p.name } })) {
			bump(skipped, "permissions");
			if (!MERGE) throw new Error(`Permission ${p.name} exists — use --merge to skip`);
			continue;
		}
		await prisma.permissions.create({ data: { id: p.id, name: p.name, description: p.description } });
		bump(inserted, "permissions");
	}

	// 2. Users — track inserted IDs to guard FK dependents
	const insertedUserIds = new Set();
	for (const u of dump.data.users) {
		if (await prisma.user.findUnique({ where: { id: u.id } })) {
			bump(skipped, "users");
			if (!MERGE) throw new Error(`User ${u.id} (${u.email}) exists — use --merge to skip`);
			// Merge: attach permissions even to existing user
			const existingPerms = u.permissions.filter((p) => p.name);
			if (existingPerms.length > 0) {
				try {
					await prisma.user.update({
						where: { id: u.id },
						data: { permissions: { connect: existingPerms } },
					});
				} catch {
					/* already connected */
				}
			}
			continue;
		}
		try {
			await prisma.user.create({
				data: {
					id: u.id,
					email: u.email,
					name: u.name,
					role: u.role,
					isActive: u.isActive,
					emailVerified: u.emailVerified,
					image: u.image,
					lastLogin: u.lastLogin ? toDate(u.lastLogin) : null,
					createdAt: toDate(u.createdAt),
					updatedAt: toDate(u.updatedAt),
					permissions: { connect: u.permissions },
				},
			});
			insertedUserIds.add(u.id);
			bump(inserted, "users");
		} catch (e) {
			warn(`User ${u.email} failed (${e.message.slice(0, 80)}) — skipping`);
			bump(skipped, "users");
		}
	}

	// 3. Sessions / Accounts / Verifications — skip if user not in target
	for (const s of dump.data.sessions) {
		if (!insertedUserIds.has(s.userId) && !(await prisma.user.findUnique({ where: { id: s.userId } }))) {
			bump(skipped, "sessions");
			continue;
		}
		if (await prisma.session.findUnique({ where: { id: s.id } })) {
			bump(skipped, "sessions");
			if (!MERGE) throw new Error(`Session ${s.id} exists`);
			continue;
		}
		await prisma.session.create({
			data: {
				...s,
				expiresAt: toDate(s.expiresAt),
				createdAt: toDate(s.createdAt),
				updatedAt: toDate(s.updatedAt),
			},
		});
		bump(inserted, "sessions");
	}
	for (const a of dump.data.accounts) {
		if (!(await prisma.user.findUnique({ where: { id: a.userId } }))) {
			bump(skipped, "accounts");
			continue;
		}
		if (await prisma.account.findUnique({ where: { id: a.id } })) {
			bump(skipped, "accounts");
			if (!MERGE) throw new Error(`Account ${a.id} exists`);
			continue;
		}
		await prisma.account.create({
			data: {
				...a,
				createdAt: toDate(a.createdAt),
				updatedAt: toDate(a.updatedAt),
				accessTokenExpiresAt: a.accessTokenExpiresAt ? toDate(a.accessTokenExpiresAt) : null,
				refreshTokenExpiresAt: a.refreshTokenExpiresAt ? toDate(a.refreshTokenExpiresAt) : null,
			},
		});
		bump(inserted, "accounts");
	}
	for (const v of dump.data.verifications) {
		if (await prisma.verification.findUnique({ where: { id: v.id } })) {
			bump(skipped, "verifications");
			if (!MERGE) throw new Error(`Verification ${v.id} exists`);
			continue;
		}
		await prisma.verification.create({
			data: {
				...v,
				expiresAt: toDate(v.expiresAt),
				createdAt: toDate(v.createdAt),
				updatedAt: toDate(v.updatedAt),
			},
		});
		bump(inserted, "verifications");
	}

	// 4. Collections — skip if parent user not in target
	for (const c of dump.data.collections) {
		if (!(await prisma.user.findUnique({ where: { id: c.userId } }))) {
			bump(skipped, "collections");
			continue;
		}
		if (await prisma.collection.findUnique({ where: { id: c.id } })) {
			bump(skipped, "collections");
			if (!MERGE) throw new Error(`Collection ${c.id} exists`);
			continue;
		}
		await prisma.collection.create({
			data: { ...c, createdAt: toDate(c.createdAt), updatedAt: toDate(c.updatedAt) },
		});
		bump(inserted, "collections");
	}

	// 5. Exercises — skip if parent collection not in target
	for (const e of dump.data.exercises) {
		if (!(await prisma.collection.findUnique({ where: { id: e.collectionId } }))) {
			bump(skipped, "exercises");
			continue;
		}
		if (await prisma.exercise.findUnique({ where: { id: e.id } })) {
			bump(skipped, "exercises");
			if (!MERGE) throw new Error(`Exercise ${e.id} exists`);
			continue;
		}
		await prisma.exercise.create({
			data: { ...e, createdAt: toDate(e.createdAt), updatedAt: toDate(e.updatedAt) },
		});
		bump(inserted, "exercises");
	}

	// 6. CollectionShares — skip if collection or grantee not in target.
	//    Nullify grantedById if that user isn't present (would violate FK).
	for (const s of dump.data.collectionShares ?? []) {
		if (!(await prisma.collection.findUnique({ where: { id: s.collectionId } }))) {
			bump(skipped, "collectionShares");
			continue;
		}
		if (!(await prisma.user.findUnique({ where: { id: s.userId } }))) {
			bump(skipped, "collectionShares");
			continue;
		}
		const existing = await prisma.collectionShare.findUnique({
			where: { collectionId_userId: { collectionId: s.collectionId, userId: s.userId } },
		});
		if (existing) {
			bump(skipped, "collectionShares");
			if (!MERGE) throw new Error(`CollectionShare ${s.collectionId}/${s.userId} exists`);
			continue;
		}

		let grantedById = s.grantedById ?? null;
		if (grantedById) {
			const grantorExists = await prisma.user.findUnique({
				where: { id: grantedById },
				select: { id: true },
			});
			if (!grantorExists) {
				warn(
					`CollectionShare ${s.collectionId}/${s.userId} — grantor ${grantedById} missing, setting grantedById=null`
				);
				grantedById = null;
			}
		}

		await prisma.collectionShare.create({
			data: {
				id: s.id,
				collectionId: s.collectionId,
				userId: s.userId,
				accessLevel: s.accessLevel,
				grantedById,
				grantedAt: toDate(s.grantedAt),
			},
		});
		bump(inserted, "collectionShares");
	}

	// 7. Attempts — skip if parent exercise or user not in target
	for (const a of dump.data.attempts) {
		if (!(await prisma.exercise.findUnique({ where: { id: a.exerciseId } }))) {
			bump(skipped, "attempts");
			continue;
		}
		if (!(await prisma.user.findUnique({ where: { id: a.userId } }))) {
			bump(skipped, "attempts");
			continue;
		}
		if (await prisma.attempt.findUnique({ where: { id: a.id } })) {
			bump(skipped, "attempts");
			if (!MERGE) throw new Error(`Attempt ${a.id} exists`);
			continue;
		}
		await prisma.attempt.create({ data: { ...a, createdAt: toDate(a.createdAt) } });
		bump(inserted, "attempts");
	}

	console.log("✅ Import complete");
	console.log("   Inserted:", inserted);
	if (Object.keys(skipped).length > 0) console.log("   Skipped:", skipped);
}

main()
	.catch((e) => {
		console.error(`❌ ${e.message}`);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
