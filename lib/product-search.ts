import { Prisma } from "@prisma/client";

// Storefront Search v1 limits (public, unauthenticated endpoint): bound the
// number of ILIKE clauses a single request can generate.
const MAX_QUERY_LENGTH = 100;
const MAX_TERMS = 5;

// Trim, collapse whitespace, cap length, split into at most MAX_TERMS terms.
// Missing / empty / whitespace-only input yields no terms (no filtering).
export function parseSearchTerms(raw: string | null | undefined): string[] {
  const normalized = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH).trim();

  return normalized ? normalized.split(" ").slice(0, MAX_TERMS) : [];
}

// Escape LIKE/ILIKE metacharacters so customer text is matched literally by
// Prisma's `contains` (which wraps the value in `%…%`). PostgreSQL's default
// LIKE escape character is backslash, so it must be escaped first.
export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// Every term must match (AND); a term may match any of Product name,
// Category name, immediate parent Category name, or Color name (OR).
// Size and Color.value are intentionally not searched.
export function buildProductSearchFilter(terms: string[]): Prisma.ProductWhereInput[] {
  return terms.map((term) => {
    const contains = { contains: escapeLikeTerm(term), mode: "insensitive" as const };

    return {
      OR: [
        { name: contains },
        { category: { name: contains } },
        { category: { parent: { name: contains } } },
        { color: { name: contains } },
      ],
    };
  });
}
