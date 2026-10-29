#!/usr/bin/env node
// scripts/verify-srs-pr2c.mjs
//
// Verify the three behavioural changes in PR-2c:
//   1. GET /exercises/drill/global returns collectionId + collectionName
//   2. The chosen exercise belongs to a STUDY+ collection (not VIEW-only)
//   3. Submit in random mode does NOT modify CardState (SRS scheduling is
//      due-mode only)
//   4. Submit in due mode DOES advance the CardState
//
// Usage:
//   node scripts/verify-srs-pr2c.mjs <email> <password>
//
// WARNING: mutates the dev DB for the given user:
//   - Force-dues existing CardStates (nextReviewAt = past)
//   - Submits one random-mode attempt on a fresh or existing exercise
//   - Force-dues that exercise and submits one due-mode attempt
// Leaves behind 2 Attempts and up to 1 CardState. Safe to re-run.

import { PrismaClient } from "@prisma/client";

const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
	console.error("Usage: node scripts/verify-srs-pr2c.mjs <email> <password>");
	process.exit(1);
}

const prisma = new PrismaClient();

let cookies = "";
let userId = "";
let failures = 0;

function section(t) {
	console.log(`\n── ${t} ${"─".repeat(Math.max(0, 50 - t.length))}`);
}
function ok(m) {
	console.log(`  ✅ ${m}`);
}
function fail(m) {
	console.error(`  ❌ ${m}`);
	failures++;
}

async function api(method, path, body) {
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: {
			Cookie: cookies,
			Origin: ORIGIN,
			...(body ? { "Content-Type": "application/json" } : {}),
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	const text = await res.text();
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch {
		parsed = text;
	}
	return { status: res.status, body: parsed };
}

async function main() {
	// ── Sign in
	section("Sign in");
	const signRes = await fetch(`${BASE}/api/auth/sign-in/email`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: ORIGIN },
		body: JSON.stringify({ email, password }),
	});
	if (!signRes.ok) {
		console.error("Sign-in failed:", await signRes.text());
		process.exit(1);
	}
	cookies = signRes.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
	const me = await api("GET", "/me");
	userId = me.body.id;
	ok(`signed in as ${me.body.email} (${userId})`);

	// ── Compute studyable set locally (mirrors SrsService logic)
	const [owned, shared] = await Promise.all([
		prisma.collection.findMany({ where: { userId }, select: { id: true } }),
		prisma.collectionShare.findMany({
			where: { userId, accessLevel: { in: ["STUDY", "EDIT"] } },
			select: { collectionId: true },
		}),
	]);
	const studyableIds = new Set([...owned.map((c) => c.id), ...shared.map((s) => s.collectionId)]);
	console.log(`  studyable collections: ${studyableIds.size}`);

	// ── Force existing CardStates due (only user's own)
	const forced = await prisma.cardState.updateMany({
		where: { userId },
		data: { nextReviewAt: new Date(Date.now() - 3_600_000) },
	});
	console.log(`  force-dued ${forced.count} existing CardStates`);

	// ── CHECK 1: /drill/global returns collectionId + collectionName
	section("1. Global drill returns collectionId + collectionName");
	const drill = await api("GET", "/exercises/drill/global");
	if (drill.status !== 200) {
		fail(`/drill/global failed: ${drill.status} ${JSON.stringify(drill.body).slice(0, 200)}`);
		if (drill.status === 404) {
			console.error(
				"  → 404 means no due exercises at all, or route ordering bug (global matched as collectionId)"
			);
		}
		return;
	}
	ok(`status 200, exercise ${drill.body.id}`);
	if (!drill.body.collectionId) fail("collectionId missing in response");
	else ok(`collectionId: ${drill.body.collectionId}`);
	if (!drill.body.collectionName) fail("collectionName missing in response");
	else ok(`collectionName: ${drill.body.collectionName}`);

	// ── CHECK 2: that collectionId is STUDY+
	section("2. Drill exercise belongs to STUDY+ collection");
	if (studyableIds.has(drill.body.collectionId)) {
		ok("collection in studyable set (owned or STUDY/EDIT share)");
	} else {
		fail(`collection ${drill.body.collectionId} is NOT in studyable set — SECURITY BUG`);
	}

	// ── Pick a test exercise: any accessible one (fresh preferred)
	const candidate =
		(await prisma.exercise.findFirst({
			where: {
				collectionId: { in: [...studyableIds] },
				isActive: true,
				cardStates: { none: { userId } },
			},
		})) ??
		(await prisma.exercise.findFirst({
			where: { collectionId: { in: [...studyableIds] }, isActive: true },
		}));
	if (!candidate) {
		fail("no exercise available for test — abort");
		return;
	}
	const testExId = candidate.id;
	const testCollId = candidate.collectionId;
	const correctAnswer = candidate.correctAnswer;
	console.log(`  test exercise: ${testExId} in collection ${testCollId}, answer has ${correctAnswer.length} chars`);

	// ── CHECK 3: random-mode submit does NOT modify CardState
	section("3. Random-mode submit does not modify CardState");
	const beforeRandom = await prisma.cardState.findUnique({
		where: { userId_exerciseId: { userId, exerciseId: testExId } },
	});
	console.log(
		`  CardState before: ${beforeRandom ? `reps=${beforeRandom.repetitions} int=${beforeRandom.interval} lapses=${beforeRandom.lapses}` : "(absent)"}`
	);

	const r1 = await api("POST", `/exercises/drill/${testCollId}/submit`, {
		exerciseId: testExId,
		userAnswer: correctAnswer,
	});
	if (r1.status !== 200) {
		fail(`random submit returned ${r1.status}`);
	} else {
		ok(`random submit 200, isCorrect=${r1.body.isCorrect}`);
	}
	if (r1.body.nextReviewAt !== undefined && r1.body.nextReviewAt !== null) {
		fail(`nextReviewAt must be absent in random mode, got "${r1.body.nextReviewAt}"`);
	} else {
		ok("nextReviewAt absent in response (correct)");
	}

	const afterRandom = await prisma.cardState.findUnique({
		where: { userId_exerciseId: { userId, exerciseId: testExId } },
	});

	if (beforeRandom === null && afterRandom === null) {
		ok("CardState still absent (random did not create it)");
	} else if (beforeRandom === null && afterRandom !== null) {
		fail("CardState WAS created in random mode (should not be)");
	} else if (beforeRandom && afterRandom) {
		const unchanged =
			beforeRandom.repetitions === afterRandom.repetitions &&
			beforeRandom.interval === afterRandom.interval &&
			beforeRandom.lapses === afterRandom.lapses &&
			Math.abs(beforeRandom.easiness - afterRandom.easiness) < 0.0001;
		if (unchanged) ok("CardState unchanged (reps / int / lapses / ease identical)");
		else
			fail(
				`CardState CHANGED in random mode: reps ${beforeRandom.repetitions}→${afterRandom.repetitions}, int ${beforeRandom.interval}→${afterRandom.interval}`
			);
	}

	// ── CHECK 4: due-mode submit DOES advance CardState
	section("4. Due-mode submit advances CardState");
	// Ensure due: upsert with past nextReviewAt (preserves existing reps if any)
	await prisma.cardState.upsert({
		where: { userId_exerciseId: { userId, exerciseId: testExId } },
		create: {
			userId,
			exerciseId: testExId,
			easiness: 2.5,
			repetitions: 0,
			interval: 0,
			lapses: 0,
			nextReviewAt: new Date(Date.now() - 3_600_000),
		},
		update: { nextReviewAt: new Date(Date.now() - 3_600_000) },
	});
	const beforeDue = await prisma.cardState.findUnique({
		where: { userId_exerciseId: { userId, exerciseId: testExId } },
	});
	console.log(`  CardState before due submit: reps=${beforeDue.repetitions} int=${beforeDue.interval}`);

	const r2 = await api("POST", `/exercises/drill/${testCollId}/submit?mode=due`, {
		exerciseId: testExId,
		userAnswer: correctAnswer,
	});
	if (r2.status !== 200) {
		fail(`due-mode submit returned ${r2.status}`);
	} else if (!r2.body.nextReviewAt) {
		fail("nextReviewAt missing in due-mode response");
	} else {
		ok(`due-mode submit 200, isCorrect=${r2.body.isCorrect}, nextReviewAt=${r2.body.nextReviewAt}`);
	}

	const afterDue = await prisma.cardState.findUnique({
		where: { userId_exerciseId: { userId, exerciseId: testExId } },
	});
	if (afterDue && beforeDue) {
		if (afterDue.repetitions > beforeDue.repetitions) {
			ok(`repetitions advanced: ${beforeDue.repetitions} → ${afterDue.repetitions}`);
		} else {
			fail(`repetitions did NOT advance (still ${afterDue.repetitions})`);
		}
		if (afterDue.nextReviewAt.getTime() > Date.now()) {
			ok("nextReviewAt is now in the future (card scheduled)");
		} else {
			fail("nextReviewAt is still in the past — card not rescheduled");
		}
	} else {
		fail("CardState missing after due-mode submit");
	}

	// ── Summary
	console.log("");
	if (failures === 0) {
		console.log("✅ All PR-2c behavioural checks passed.");
	} else {
		console.error(`❌ ${failures} check(s) failed.`);
		process.exitCode = 1;
	}
}

main()
	.catch((e) => {
		console.error("❌", e.message);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
