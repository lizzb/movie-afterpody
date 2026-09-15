/**
 * Pass U72 — podcast-profile priors (pure).
 *
 * A show that has only ever covered 80s horror is unlikely to be talking about
 * a 2025 rom-com. This module turns a show's *confirmed* links into soft
 * distributions over genre, certification and release era. It never reads
 * auto-links, never boosts anything, and never excludes a candidate: the
 * matcher applies a small bounded demotion which exact-title or
 * title+year evidence overrides outright.
 *
 * No database access lives here so the regression corpus can build profiles
 * inline.
 */

/** A confirmed film of one show, reduced to the three profiled dimensions. */
export interface ProfileMovie {
  genreIds: string[];
  certification: string | null;
  releaseYear: number | null;
}

export interface PodcastProfile {
  /** Number of distinct confirmed films the profile was built from. */
  sample: number;
  /** genre id → share of confirmed films carrying it (0-1). */
  genreShare: Record<string, number>;
  /** certification → share of confirmed films carrying it (0-1). */
  certShare: Record<string, number>;
  /** decade start (1980, 1990, …) → share of confirmed films in it (0-1). */
  decadeShare: Record<number, number>;
  /** Each dimension is only used when enough confirmed films declare it. */
  hasGenre: boolean;
  hasCert: boolean;
  hasEra: boolean;
}

/** Below this many confirmed films a show gets no prior at all. */
export const PROFILE_MIN_SAMPLE = 8;

/** A dimension is only trusted when this share of the sample declares it. */
export const PROFILE_MIN_COVERAGE = 0.6;

/**
 * Combined familiarity of a candidate's genres in the show's history, below
 * which the candidate counts as an unusual genre for this show. Summing the
 * candidate's genres rather than taking the best one keeps a single incidental
 * overlap (one horror-comedy in a horror show) from excusing a rom-com.
 */
export const UNUSUAL_GENRE_SHARE = 0.25;

/** Bounded demotions — the total is capped, and they are never boosts. */
export const GENRE_PENALTY = 4;
export const ERA_PENALTY = 3;
export const CERT_PENALTY = 2;
export const PROFILE_PENALTY_CAP = 8;

/**
 * Builds a show's profile from its confirmed films, or null when the sample is
 * too small to say anything.
 */
export function buildPodcastProfile(movies: ProfileMovie[]): PodcastProfile | null {
  const sample = movies.length;
  if (sample < PROFILE_MIN_SAMPLE) return null;

  const genreCounts: Record<string, number> = {};
  const certCounts: Record<string, number> = {};
  const decadeCounts: Record<number, number> = {};
  let withGenre = 0;
  let withCert = 0;
  let withYear = 0;

  for (const m of movies) {
    if (m.genreIds.length) {
      withGenre += 1;
      for (const g of new Set(m.genreIds)) genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    }
    if (m.certification) {
      withCert += 1;
      certCounts[m.certification] = (certCounts[m.certification] ?? 0) + 1;
    }
    if (m.releaseYear) {
      withYear += 1;
      const decade = Math.floor(m.releaseYear / 10) * 10;
      decadeCounts[decade] = (decadeCounts[decade] ?? 0) + 1;
    }
  }

  const share = <K extends string | number>(counts: Record<K, number>) => {
    const out = {} as Record<K, number>;
    for (const key of Object.keys(counts) as K[]) out[key] = counts[key] / sample;
    return out;
  };

  return {
    sample,
    genreShare: share(genreCounts),
    certShare: share(certCounts),
    decadeShare: share(decadeCounts),
    hasGenre: withGenre / sample >= PROFILE_MIN_COVERAGE,
    hasCert: withCert / sample >= PROFILE_MIN_COVERAGE,
    hasEra: withYear / sample >= PROFILE_MIN_COVERAGE,
  };
}
