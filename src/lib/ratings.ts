/**
 * Pass Y — one normalised ladder so movie (MPA) and TV ratings sort together.
 * Unrated is deliberately absent from the ladder: it is never silently included
 * or excluded, it has its own opt-in toggle.
 */

export const RATING_LADDER = [
  { rank: 1, label: "TV-Y", codes: ["TV-Y"] },
  { rank: 2, label: "TV-Y7", codes: ["TV-Y7", "TV-Y7-FV"] },
  { rank: 3, label: "G", codes: ["G", "TV-G"] },
  { rank: 4, label: "PG", codes: ["PG", "TV-PG"] },
  { rank: 5, label: "PG-13", codes: ["PG-13", "TV-14"] },
  { rank: 6, label: "R", codes: ["R", "TV-MA"] },
  { rank: 7, label: "NC-17", codes: ["NC-17", "X"] },
] as const;

/** Highest rank in the ladder — the "allow everything" setting. */
export const RATING_MAX = 7;

const RANK_BY_CODE = new Map<string, number>();
for (const step of RATING_LADDER) {
  for (const code of step.codes) RANK_BY_CODE.set(code.toUpperCase(), step.rank);
}

/** Ladder rank for a stored certification, or null when unrated/unknown. */
export function ratingRank(certification: string | null | undefined): number | null {
  const code = (certification ?? "").trim().toUpperCase();
  if (!code) return null;
  return RANK_BY_CODE.get(code) ?? null;
}

/** Short marker for a card: the certification itself, or "NR" when there is none. */
export function ratingLabel(certification: string | null | undefined): string {
  const code = (certification ?? "").trim();
  return code || "NR";
}

export function isUnrated(certification: string | null | undefined): boolean {
  return ratingRank(certification) === null;
}
