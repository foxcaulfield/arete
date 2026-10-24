// src/common/json-array.ts

/**
 * Parses a "string[]-as-JSON-string" field into a `string[]`.
 *
 * Prisma stores these as `String` columns (Option A — provider-agnostic JSON arrays
 * for Postgres/SQLite compatibility). At runtime, the value may arrive in any of
 * these shapes depending on how it was written and which client is active:
 *
 *   - `["a", "b"]`      → already an array (Prisma/client mismatch — defensive)
 *   - `'["a","b"]'`     → canonical single-encoded JSON string
 *   - `'"[\"a\",\"b\"]"'` → double-encoded (legacy write path bug — still handled)
 *   - `''`, `null`, `undefined`, garbage → returns `[]`
 *
 * Using `unknown` for the parameter means every existing call site keeps
 * type-checking — it's a strict superset of the old `(value: string)` signature.
 */
export function parseJsonArray(value: unknown): string[] {
	// Already an array — filter non-strings defensively
	if (Array.isArray(value)) {
		return value.filter((v): v is string => typeof v === "string");
	}

	if (typeof value !== "string") return [];

	const tryParse = (s: string): string[] | null => {
		try {
			const parsed: unknown = JSON.parse(s);

			// Direct hit: JSON array string
			if (Array.isArray(parsed)) {
				return parsed.filter((v): v is string => typeof v === "string");
			}

			// Double-encoded: parsed to a string that itself looks like a JSON array
			if (typeof parsed === "string" && parsed.trimStart().startsWith("[")) {
				const reparsed: unknown = JSON.parse(parsed);
				if (Array.isArray(reparsed)) {
					return reparsed.filter((v): v is string => typeof v === "string");
				}
			}

			return null;
		} catch {
			return null;
		}
	};

	return tryParse(value) ?? [];
}

/**
 * Serializes a `string[]` into a JSON-encoded `TEXT` value for the DB.
 *
 * Idempotent: if given a string that's already a JSON array, it parses and
 * re-encodes so we never produce a double-encoded value:
 *
 *   serializeJsonArray(["a", "b"])      → '["a","b"]'
 *   serializeJsonArray('["a","b"]')     → '["a","b"]'      (not '"[\"a\",\"b\"]"')
 *   serializeJsonArray('"[\"a\",\"b\"]"') → '["a","b"]'    (self-heals legacy)
 *   serializeJsonArray(null/undefined)  → '[]'
 *   serializeJsonArray("garbage")       → '[]'
 *
 * Prevents the bug that produced today's double-encoded distractors from
 * recurring on any code path that passes a string where an array was expected.
 */
export function serializeJsonArray(value: unknown): string {
	if (Array.isArray(value)) {
		return JSON.stringify(value.filter((v): v is string => typeof v === "string"));
	}
	if (typeof value === "string") {
		return JSON.stringify(parseJsonArray(value));
	}
	return "[]";
}
