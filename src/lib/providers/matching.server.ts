import { normalizeTitle } from "./shared.server";

export interface MatchSignals {
  /** Which rule produced the base score. */
  rule: "exact" | "contained" | "tokens" | "weak" | "description";
  tokenOverlap: number;
  yearMatch: "same" | "near" | "mismatch" | "unknown";
  /** Movie title is a single short word — a common source of false positives. */
  genericTitle: boolean;
  /** Movie title is under 4 characters ("Er", "P2") — near-useless as evidence alone. */
  shortTitle: boolean;
  /** How many times this movie has been rejected as a match anywhere. */
  rejectedBefore: number;
  /** The movie title appears verbatim in the episode description. */
  descTitle: boolean;
  /** Year agreement between the movie and years mentioned in the description. */
  descYear: "same" | "near" | "mismatch" | "unknown";
}

export interface MovieMatchCandidate {
  movieId: string;
  title: string;
  releaseYear: number | null;
  confidence: number;
  reason: string;
  signals: MatchSignals;
}

export interface MatchOptions {
  /** Learned negative evidence: movieId → number of recorded rejections. */
  rejectionCountByMovie?: Record<string, number> | undefined;
  /** Episode description / show notes — read for titles and years. */
  description?: string | null | undefined;
}

const YEAR_RE = /\b(19\d{2}|20\d{2})\b/;
const YEAR_ALL_RE = /\b(19\d{2}|20\d{2})\b/g;
/** Descriptions get long; only the opening is reliably about the episode's subject. */
const DESC_CHARS = 700;


function extractYear(title: string): number | null {
  const m = title.match(YEAR_RE);
  return m ? Number(m[1]) : null;
}

function removeYear(title: string): string {
  return title.replace(YEAR_RE, "").replace(/\s+/g, " ").trim();
}

function tokenSet(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

/** Single short word ("Genius", "Cats") matches far too many episode titles. */
function isGenericTitle(title: string): boolean {
  const tokens = normalizeTitle(title).split(" ").filter(Boolean);
  return tokens.length === 1 && (tokens[0]?.length ?? 0) <= 8;
}

export function matchEpisodeToMovies(
  episodeTitle: string,
  movies: { id: string; title: string; release_year: number | null }[],
  options: MatchOptions = {},
): MovieMatchCandidate[] {
  const rejectionCounts = options.rejectionCountByMovie ?? {};
  const episodeYear = extractYear(episodeTitle);
  const episodeNoYear = removeYear(episodeTitle);
  const episodeTokens = tokenSet(episodeNoYear);

  // Description-aware signals (Pass C2): deterministic, no AI, no network.
  const descRaw = (options.description ?? "")
    .replace(/<[^>]*>/g, " ")
    .slice(0, DESC_CHARS);
  const descPadded = descRaw ? ` ${normalizeTitle(descRaw)} ` : "";
  const descYears = new Set<number>(
    descRaw ? (descRaw.match(YEAR_ALL_RE) ?? []).map((y) => Number(y)) : [],
  );


  const candidates: MovieMatchCandidate[] = movies.map((movie) => {
    const movieTokens = tokenSet(movie.title);
    const movieLower = normalizeTitle(movie.title);
    const episodeLower = normalizeTitle(episodeNoYear);
    const similarity = jaccard(episodeTokens, movieTokens);

    let confidence = 0;
    let reason = "";
    let rule: MatchSignals["rule"] = "weak";

    // Exact or near-exact title containment
    if (episodeLower === movieLower) {
      confidence = 100;
      reason = "exact title";
      rule = "exact";
    } else if (episodeLower.includes(movieLower) || movieLower.includes(episodeLower)) {
      confidence = 90;
      reason = "title contained";
      rule = "contained";
    } else if (similarity >= 0.85) {
      confidence = 85;
      reason = "near-exact tokens";
      rule = "tokens";
    } else if (similarity >= 0.6) {
      confidence = 70;
      reason = "strong token overlap";
      rule = "tokens";
    } else if (similarity >= 0.4) {
      confidence = 55;
      reason = "moderate token overlap";
      rule = "tokens";
    } else if ([...movieTokens].every((t) => episodeTokens.has(t))) {
      confidence = 60;
      reason = "all movie words present";
      rule = "tokens";
    } else {
      confidence = Math.round(similarity * 100);
      reason = "token overlap";
      rule = "weak";
    }

    // Year bonus/penalty
    let yearMatch: MatchSignals["yearMatch"] = "unknown";
    if (movie.release_year && episodeYear) {
      if (movie.release_year === episodeYear) {
        confidence = Math.min(100, confidence + 10);
        reason += " + year match";
        yearMatch = "same";
      } else if (Math.abs(movie.release_year - episodeYear) <= 1) {
        confidence = Math.min(100, confidence + 3);
        reason += " + year near";
        yearMatch = "near";
      } else {
        yearMatch = "mismatch";
        if (confidence < 80) {
          confidence = Math.max(0, confidence - 15);
          reason += " - year mismatch";
        }
      }
    }

    // Learned penalties: generic one-word titles and movies rejected before.
    const genericTitle = isGenericTitle(movie.title);
    if (genericTitle && rule !== "exact") {
      confidence = Math.max(0, confidence - 12);
      reason += " - generic title";
    }

    // Description-aware evidence: the show notes usually name the film outright,
    // often with its release year, even when the episode title is a pun.
    let descTitle = false;
    let descYear: MatchSignals["descYear"] = "unknown";
    const longEnough = movieLower.replace(/ /g, "").length >= 5 || movieTokens.size >= 2;
    if (descPadded && longEnough && !(genericTitle && movieLower.length <= 4)) {
      descTitle = descPadded.includes(` ${movieLower} `);
    }

    if (descTitle) {
      if (rule === "weak") {
        // Title gave us nothing; the description alone is decent-but-unconfirmed evidence.
        confidence = Math.max(confidence, genericTitle ? 40 : 48);
        reason = "named in description";
        rule = "description";
      } else {
        confidence = Math.min(100, confidence + 10);
        reason += " + named in description";
      }

      if (movie.release_year && descYears.size > 0) {
        if (descYears.has(movie.release_year)) {
          confidence = Math.min(100, confidence + 10);
          reason += " + year in description";
          descYear = "same";
        } else if ([...descYears].some((y) => Math.abs(y - movie.release_year!) <= 1)) {
          confidence = Math.min(100, confidence + 3);
          reason += " + year near in description";
          descYear = "near";
        } else {
          descYear = "mismatch";
          if (rule === "description") {
            confidence = Math.max(0, confidence - 8);
            reason += " - year not in description";
          }
        }
      }
    }

    const rejectedBefore = rejectionCounts[movie.id] ?? 0;
    if (rejectedBefore >= 2 && rule !== "exact") {
      confidence = Math.max(0, confidence - Math.min(25, rejectedBefore * 6));
      reason += ` - rejected ${rejectedBefore}x before`;
    }

    // Very short titles ("Er", "P2", "UHF") appear inside all sorts of episode
    // titles by accident. Only an exact whole-title match is trustworthy.
    const shortTitle = movieLower.replace(/ /g, "").length < 4;
    if (shortTitle && rule !== "exact") {
      confidence = Math.min(confidence, 15);
      reason += " - very short title";
    }


    return {
      movieId: movie.id,
      title: movie.title,
      releaseYear: movie.release_year,
      confidence,
      reason,
      signals: {
        rule,
        tokenOverlap: Math.round(similarity * 100) / 100,
        yearMatch,
        genericTitle,
        shortTitle,
        rejectedBefore,
        descTitle,
        descYear,
      },
    };

  });

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.filter((c) => c.confidence >= 25);
}
