// src/common/prisma-filters.ts
//
// Provider-agnostic string filters.
//
// Postgres: `equals`/`contains` are case-sensitive by default, so we pass `mode: "insensitive"`.
// SQLite:   `contains` (LIKE) is case-insensitive by default, so we drop `mode`.
//           `equals` becomes case-sensitive on SQLite — accepted tradeoff (see below).
//
// The `mode` property is included in the type for Postgres, ignored on SQLite via structural typing.

const IS_SQLITE = process.env.DB_PROVIDER === "sqlite";

type CaseInsensitiveFilter = {
	equals?: string;
	contains?: string;
	mode?: "insensitive";
};

export function caseInsensitiveEquals(value: string): CaseInsensitiveFilter {
	return IS_SQLITE ? { equals: value } : { equals: value, mode: "insensitive" };
}

export function caseInsensitiveContains(value: string): CaseInsensitiveFilter {
	return IS_SQLITE ? { contains: value } : { contains: value, mode: "insensitive" };
}
