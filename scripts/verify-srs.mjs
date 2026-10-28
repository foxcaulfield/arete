#!/usr/bin/env node
// scripts/verify-srs.mjs
//
// End-to-end verification of the SRS (SM-2) backend.
// Full lifecycle: sign in → pick due exercise → 3 submits with DB assertions
// → due-count delta → due list endpoint shape.
//
// Usage:
//   node scripts/verify-srs.mjs <email> <password> <collectionId>
//
// WARNING: mutates the database for the given user+collection:
//   - Deletes any pre-existing CardState for the picked exercise (so the
//     test starts from default SM-2 state — otherwise repetitions=1
//     assumption breaks)
//   - Creates 3 Attempts
//   - Creates 1 CardState
// Intended for dev DBs. Run against sqlite@sqlite.com or a throwaway user.

import { PrismaClient } from "@prisma/client";

const BASE = process.env.API_URL || "http://localhost:3000";
const ORIGIN = process.env.TRUSTED_ORIGIN || "http://localhost:3000";

const [email, password, collectionId] = process.argv.slice(2);
if (!email || !password || !collectionId) {
	console.error("Usage: node scripts/verify-srs.mjs <email> <password> <collectionId>");
	process.exit(1);
}

const prisma = new PrismaClient();

const C = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	cyan: "\x1b[36m",
	bold: "\x1b[1m",
};

let cookies = "";
let userId = "";
let failures = 0;

function section(title) {
	const pad = "─".repeat(Math.max(0, 52 - title.length));
	console.log(`\n${C.cyan}── ${title} ${pad}${C.reset}`);
}

function ok(msg) {
	console.log(`  ${C.green}✅${C.reset} ${msg}`);
}

function fail(msg) {
	console.error(`  ${C.red}❌ ${msg}${C.reset}`);
	failures++;
}

function assertEq(actual, expected, label) {
	if (actual === expected) ok(`${label}: ${JSON.stringify(actual)}`);
	else fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertApprox(actual, expected, tolerance, label) {
	if (Math.abs(actual - expected) <= tolerance) ok(`${label}: ${actual.toFixed(4)} ≈ ${expected}`);
	else fail(`${label}: expected ≈${expected}, got ${actual}`);
}

function assertWithinHours(actualIso, expectedHoursOffset, toleranceHours, label) {
	const expected = Date.now() + expectedHoursOffset * 60 * 60 * 1000;
	const actual = new Date(actualIso).getTime();
	const diffH = Math.abs(actual - expected) / (60 * 60 * 1000);
	if (diffH <= toleranceHours)
		ok(`${label}: ${new Date(actualIso).toISOString()} ≈ now+${expectedHoursOffset}h (Δ ${diffH.toFixed(1)}h)`);
	else fail(`${label}: expected ≈ now+${expectedHoursOffset}h, actual is off by ${diffH.toFixed(1)}h`);
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
	// ── 1. Sign in
	section("1. Sign in");
	const signRes = await fetch(`${BASE}/api/auth/sign-in/email`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: ORIGIN },
		body: JSON.stringify({ email, password }),
	});
	if (!signRes.ok) {
		const t = await signRes.text();
		console.error(`${C.red}Sign-in failed (${signRes.status}): ${t}${C.reset}`);
		process.exit(1);
	}
	cookies = signRes.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
	if (!cookies) {
		console.error(`${C.red}Sign-in succeeded but returned no Set-Cookie${C.reset}`);
		process.exit(1);
	}

	const me = await api("GET", "/me");
	if (me.status !== 200) {
		console.error(`${C.red}/me failed: ${me.status}${C.reset}`);
		process.exit(1);
	}
	userId = me.body.id;
	ok(`signed in as ${me.body.email} (${userId})`);

	// ── 2. Pick due exercise
	section("2. Pick due exercise");
	const drill = await api("GET", `/exercises/drill/${collectionId}?mode=due`);
	if (drill.status !== 200) {
		console.error(`${C.red}drill?mode=due failed: ${drill.status} ${JSON.stringify(drill.body)}${C.reset}`);
		process.exit(1);
	}
	const exerciseId = drill.body.id;
	const exerciseType = drill.body.type;
	ok(`picked exercise ${exerciseId} (${exerciseType})`);
	ok(`question: ${String(drill.body.question).slice(0, 70)}…`);

	// ── 3. Reset CardState for a deterministic run
	section("3. Reset CardState (deterministic start)");
	const existingState = await prisma.cardState.findUnique({
		where: { userId_exerciseId: { userId, exerciseId } },
	});
	if (existingState) {
		console.log(
			`  ${C.yellow}⚠${C.reset}  exercise already has CardState (repetitions=${existingState.repetitions}, lapses=${existingState.lapses}) — deleting to start from default`
		);
		await prisma.cardState.delete({ where: { id: existingState.id } });
		ok("CardState deleted");
	} else {
		ok("no pre-existing CardState (fresh exercise)");
	}

	// ── 4. Baseline due-count (after reset)
	section("4. Baseline due-count");
	const baseline = await api("GET", `/exercises/due-count?collectionId=${collectionId}`);
	if (baseline.status !== 200) {
		fail(`due-count failed: ${baseline.status}`);
		return;
	}
	const initialCount = baseline.body.count;
	ok(`due count: ${initialCount}`);
	if (initialCount < 1) {
		fail("due count is 0 — nothing to verify (empty collection?)");
		return;
	}

	// ── 5. Look up correct answer via Prisma
	section("5. Resolve correct answer");
	const exercise = await prisma.exercise.findUnique({
		where: { id: exerciseId },
		select: { correctAnswer: true },
	});
	if (!exercise || !exercise.correctAnswer) {
		fail(`exercise ${exerciseId} not found in DB (or correctAnswer is empty)`);
		return;
	}
	const correctAnswer = exercise.correctAnswer;
	ok(`correct answer resolved (${correctAnswer.length} chars)`);

	// ── 6. Submit CORRECT #1 → repetitions=1, interval=1d, lapses=0, ease=2.5
	section("6. Submit CORRECT #1 (new card)");
	const r1 = await api("POST", `/exercises/drill/${collectionId}/submit`, {
		exerciseId,
		userAnswer: correctAnswer,
	});
	if (r1.status !== 200) {
		fail(`submit #1 failed: ${r1.status} ${JSON.stringify(r1.body)}`);
		return;
	}
	assertEq(r1.body.isCorrect, true, "response.isCorrect");
	if (r1.body.nextReviewAt) assertWithinHours(r1.body.nextReviewAt, 24, 1, "response.nextReviewAt");
	else fail("response.nextReviewAt missing");

	const c1 = await prisma.cardState.findUnique({ where: { userId_exerciseId: { userId, exerciseId } } });
	if (!c1) {
		fail("CardState not created after first submit");
		return;
	}
	assertEq(c1.repetitions, 1, "CardState.repetitions");
	assertEq(c1.interval, 1, "CardState.interval");
	assertEq(c1.lapses, 0, "CardState.lapses");
	assertApprox(c1.easiness, 2.5, 0.001, "CardState.easiness");

	// ── 7. Submit CORRECT #2 → repetitions=2, interval=6d
	section("7. Submit CORRECT #2 (review)");
	const r2 = await api("POST", `/exercises/drill/${collectionId}/submit`, {
		exerciseId,
		userAnswer: correctAnswer,
	});
	if (r2.status !== 200) {
		fail(`submit #2 failed: ${r2.status}`);
		return;
	}
	assertEq(r2.body.isCorrect, true, "response.isCorrect");
	if (r2.body.nextReviewAt) assertWithinHours(r2.body.nextReviewAt, 6 * 24, 1, "response.nextReviewAt");

	const c2 = await prisma.cardState.findUnique({ where: { userId_exerciseId: { userId, exerciseId } } });
	if (!c2) {
		fail("CardState missing after second submit");
		return;
	}
	assertEq(c2.repetitions, 2, "CardState.repetitions");
	assertEq(c2.interval, 6, "CardState.interval");
	assertEq(c2.lapses, 0, "CardState.lapses");

	// ── 8. Submit WRONG → repetitions=0, interval=1, lapses=1, ease≈2.18
	section("8. Submit WRONG (reset)");
	const wrongAnswer = "__srs_verify_wrong_" + Date.now() + "__";
	const r3 = await api("POST", `/exercises/drill/${collectionId}/submit`, {
		exerciseId,
		userAnswer: wrongAnswer,
	});
	if (r3.status !== 200) {
		fail(`submit #3 failed: ${r3.status}`);
		return;
	}
	assertEq(r3.body.isCorrect, false, "response.isCorrect");
	if (r3.body.nextReviewAt) assertWithinHours(r3.body.nextReviewAt, 24, 1, "response.nextReviewAt");
	assertEq(r3.body.correctAnswer, correctAnswer, "response.correctAnswer matches DB");

	const c3 = await prisma.cardState.findUnique({ where: { userId_exerciseId: { userId, exerciseId } } });
	if (!c3) {
		fail("CardState missing after third submit");
		return;
	}
	assertEq(c3.repetitions, 0, "CardState.repetitions (reset)");
	assertEq(c3.interval, 1, "CardState.interval (reset)");
	assertEq(c3.lapses, 1, "CardState.lapses (incremented)");
	assertApprox(c3.easiness, 2.18, 0.01, "CardState.easiness (dropped by 0.32)");

	// ── 9. Due-count delta
	section("9. Due-count after");
	const after = await api("GET", `/exercises/due-count?collectionId=${collectionId}`);
	if (after.status !== 200) {
		fail(`due-count after failed: ${after.status}`);
		return;
	}
	assertEq(after.body.count, initialCount - 1, "due-count decreased by 1");

	// ── 10. Due list endpoint shape
	section("10. Due list endpoint");
	const dueList = await api("GET", `/exercises/due/${collectionId}?limit=5`);
	if (dueList.status !== 200) {
		fail(`due list failed: ${dueList.status}`);
		return;
	}
	if (!Array.isArray(dueList.body.data)) {
		fail("due list .data is not an array");
		return;
	}
	ok(`due list: ${dueList.body.data.length} rows (total ${dueList.body.total})`);
	if (dueList.body.data.length > 5) fail(`limit=5 violated: ${dueList.body.data.length} rows`);
	if (typeof dueList.body.total !== "number") fail("due list .total is not a number");

	// ── Summary
	section("Summary");
	console.log(`\n  ${C.dim}Exercise used:${C.reset} ${exerciseId}\n  ${C.dim}User:${C.reset} ${email} (${userId})`);
	console.log(
		`  ${C.dim}Test left behind:${C.reset} 3 Attempts + 1 CardState (repetitions=0, lapses=1, nextReviewAt=tomorrow)\n`
	);

	if (failures === 0) {
		console.log(`${C.green}${C.bold}✅ All SRS checks passed.${C.reset}\n`);
	} else {
		console.log(`${C.red}${C.bold}❌ ${failures} check(s) failed.${C.reset}\n`);
		process.exitCode = 1;
	}
}

main()
	.catch((e) => {
		console.error(`\n${C.red}❌ ${e.message}${C.reset}\n`);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
