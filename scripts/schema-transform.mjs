// scripts/schema-transform.mjs
//
// Derive the SQLite Prisma schema from the canonical Postgres one.
// Pure text transform — no full Prisma parser. Relies on the convention that
// `enum`, `model`, `generator`, `datasource` blocks start at column 0 as
// `<kind> <Name> {` and end with `}` at column 0.
//
// Anything the transform can't handle safely THROWS instead of silently
// producing a broken or subtly different schema:
//   - unterminated blocks, blocks opened inside other blocks, one-line blocks
//   - unexpected content outside blocks
//   - `view` / `type` blocks (not supported on SQLite)
//   - a datasource provider other than postgresql/postgres
//   - any Postgres-only construct that survives the transform (final check)
//
// Rewritten / stripped:
//   - datasource.provider: "postgresql" | "postgres" -> "sqlite"
//   - datasource.extensions / schemas (single- or multi-line arrays)
//   - datasource.directUrl / shadowDatabaseUrl
//   - generator.previewFeatures: postgresqlExtensions, multiSchema,
//     fullTextSearchPostgres removed (the line is dropped if nothing is left)
//   - @db.Text / @db.Citext / @db.VarChar(N) / any @db.*
//   - @@schema("...") on models / enums
//   - @@map("...") on enum blocks (SQLite can't map enum names)
// Preserved:
//   - @@map("...") on model blocks (table-name mapping works)
//   - CRLF vs LF line endings of the input
//
// Semantics that change and CANNOT be caught by a text transform:
//   - @db.Citext columns become case-sensitive (a @unique email will allow
//     "A@x.com" and "a@x.com"). Normalise in the app or add COLLATE NOCASE.
//   - `mode: "insensitive"` filters are unsupported on SQLite.
//   - Decimal precision and Json filtering differ.
//   - Postgres migrations are not portable: use `prisma db push` for SQLite.
//   - If both schemas share generator.output they overwrite each other.
// Run `prisma validate --schema <output>` in CI as the final safety net.

import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const POSTGRES_ONLY_PREVIEWS = new Set([
	"postgresqlExtensions",
	"multiSchema",
	"fullTextSearchPostgres",
]);

const POSTGRES_PROVIDERS = new Set(["postgresql", "postgres"]);

const SCALAR_TYPES = ["String", "Int", "Float", "Boolean", "DateTime", "Json", "BigInt", "Decimal", "Bytes"];

const BLOCK_KINDS = "enum|model|view|type|generator|datasource";
const BLOCK_START_RE = new RegExp(`^(${BLOCK_KINDS})\\s+(\\w+)\\s*\\{\\s*(?:\\/\\/.*)?$`);
const ONE_LINE_BLOCK_RE = new RegExp(`^(?:${BLOCK_KINDS})\\s+\\w+\\s*\\{.*\\}\\s*$`);
const BLOCK_END_RE = /^\}\s*(?:\/\/.*)?$/;

const PROVIDER_RE = /^(\s*provider\s*=\s*)"([^"]*)"(\s*(?:\/\/.*)?)$/;
const DB_ATTR_RE = /\s+@db\.\w+(?:\([^)]*\))?(?=\s|\/\/|$)/g;

// Removes `// ...` comments (only when preceded by whitespace / line start, so
// "postgresql://..." inside a string is left alone).
const stripComment = (s) => s.replace(/(^|\s)\/\/.*$/gm, "$1");

// Reads a `key = [ ... ]` statement that may span several lines.
// Returns the joined text and the index of the last line consumed.
function readArrayStatement(lines, start) {
	let end = start;
	let text = lines[start];
	while (!stripComment(text).includes("]")) {
		end++;
		if (end >= lines.length) {
			throw new Error(`Line ${start + 1}: unterminated array`);
		}
		text += "\n" + lines[end];
	}
	return { text, end };
}

function parseArrayItems(text) {
	const match = stripComment(text).match(/\[([\s\S]*)\]/);
	return (match?.[1] ?? "")
		.split(/[,\n]/)
		.map((s) => s.trim().replace(/^"|"$/g, ""))
		.filter(Boolean);
}

export function transformToSqlite(postgresSchema) {
	const eol = postgresSchema.includes("\r\n") ? "\r\n" : "\n";
	const lines = postgresSchema.split(/\r?\n/);
	const out = [];
	const outLineNo = []; // original (1-based) line number of each output line
	const enumNames = new Set();

	let blockKind = null; // null | "enum" | "model" | "generator" | "datasource"
	let blockStartLine = 0;
	let sawProvider = false;

	const emit = (text, lineNo) => {
		out.push(text);
		outLineNo.push(lineNo);
	};

	for (let i = 0; i < lines.length; i++) {
		const lineNo = i + 1;
		let line = lines[i];

		// One-line blocks, e.g. `enum Role { USER ADMIN }`
		if (ONE_LINE_BLOCK_RE.test(line)) {
			throw new Error(`Line ${lineNo}: one-line blocks are not supported: ${line.trim()}`);
		}

		// Block start (column 0 only)
		const start = BLOCK_START_RE.exec(line);
		if (start) {
			const [, kind, name] = start;
			if (blockKind !== null) {
				throw new Error(
					`Line ${lineNo}: "${kind} ${name}" starts inside unterminated ${blockKind} block (opened on line ${blockStartLine})`,
				);
			}
			if (kind === "view" || kind === "type") {
				throw new Error(`Line ${lineNo}: "${kind}" blocks are not supported on SQLite`);
			}
			blockKind = kind;
			blockStartLine = lineNo;
			if (kind === "enum") enumNames.add(name);
			emit(line, lineNo);
			continue;
		}

		// Outside any block: only blank lines and comments are allowed
		if (blockKind === null) {
			if (line.trim() === "" || /^\s*\/\//.test(line)) {
				emit(line, lineNo);
				continue;
			}
			throw new Error(`Line ${lineNo}: unexpected content outside a block: ${line.trim()}`);
		}

		// Block end (column 0 only)
		if (BLOCK_END_RE.test(line)) {
			emit(line, lineNo);
			blockKind = null;
			continue;
		}

		// Block-specific transforms
		if (blockKind === "datasource") {
			const provider = PROVIDER_RE.exec(line);
			if (provider) {
				const [, prefix, value, suffix] = provider;
				if (!POSTGRES_PROVIDERS.has(value)) {
					throw new Error(`Line ${lineNo}: unsupported datasource provider "${value}" (expected postgresql)`);
				}
				sawProvider = true;
				emit(`${prefix}"sqlite"${suffix}`, lineNo);
				continue;
			}
			if (/^\s*(?:extensions|schemas)\s*=\s*\[/.test(line)) {
				i = readArrayStatement(lines, i).end;
				continue;
			}
			if (/^\s*(?:directUrl|shadowDatabaseUrl)\s*=/.test(line)) {
				continue;
			}
		} else if (blockKind === "generator") {
			if (/^\s*previewFeatures\s*=\s*\[/.test(line)) {
				const { text, end } = readArrayStatement(lines, i);
				const remaining = parseArrayItems(text).filter((p) => !POSTGRES_ONLY_PREVIEWS.has(p));
				i = end;
				if (remaining.length === 0) continue;
				const indent = text.match(/^\s*/)[0];
				emit(`${indent}previewFeatures = [${remaining.map((p) => `"${p}"`).join(", ")}]`, lineNo);
				continue;
			}
		} else {
			// model / enum
			if (/^\s+@@schema\(/.test(line)) continue;
			if (blockKind === "enum" && /^\s+@@map\(/.test(line)) continue;
			// Strip @db.* native-type annotations (SQLite has no native types)
			line = line.replace(DB_ATTR_RE, "");
		}

		emit(line, lineNo);
	}

	if (blockKind !== null) {
		throw new Error(`Unterminated ${blockKind} block (opened on line ${blockStartLine})`);
	}
	if (!sawProvider) {
		throw new Error('No datasource with provider "postgresql" found');
	}

	assertNoPostgresLeftovers(out, outLineNo, enumNames);

	return out.join(eol);
}

// Final safety net: fail loudly if anything Postgres-only survived.
function assertNoPostgresLeftovers(out, outLineNo, enumNames) {
	const listTypes = [...SCALAR_TYPES, ...enumNames].join("|");
	const checks = [
		[/@db\./, "@db.* attribute"],
		[/@@schema\(/, "@@schema (multiSchema)"],
		[/^\s*(?:extensions|schemas|directUrl|shadowDatabaseUrl)\s*=/, "Postgres datasource option"],
		[/\bdbgenerated\(/, "dbgenerated()"],
		[/\bUnsupported\(/, "Unsupported()"],
		[/\bops\s*:|\btype\s*:\s*(?:Gin|Gist|SpGist|Brin|Hash|BTree)\b/, "Postgres index options"],
		[new RegExp(`^\\s+\\w+\\s+(?:${listTypes})\\[\\]`), "scalar / enum list"],
		[/provider\s*=\s*"(?:postgres|postgresql|cockroachdb)"/, "Postgres provider"],
		[/\burl\s*=\s*"postgres/, "hard-coded Postgres URL"],
		[/postgresqlExtensions|multiSchema|fullTextSearchPostgres/, "Postgres preview feature"],
	];

	out.forEach((raw, idx) => {
		const code = stripComment(raw);
		if (code.trim() === "") return;
		for (const [re, label] of checks) {
			if (re.test(code)) {
				throw new Error(
					`Input line ${outLineNo[idx]}: Postgres-only construct left in output (${label}): ${raw.trim()}`,
				);
			}
		}
	});
}

// Direct-test entrypoint: node scripts/schema-transform.mjs < in.prisma > out.prisma
function isMain() {
	if (!process.argv[1]) return false;
	try {
		return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
	} catch {
		return false;
	}
}

if (isMain()) {
	try {
		process.stdout.write(transformToSqlite(readFileSync(0, "utf-8")));
	} catch (err) {
		console.error(`schema-transform: ${err.message}`);
		process.exitCode = 1;
	}
}