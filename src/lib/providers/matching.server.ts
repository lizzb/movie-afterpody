import { normalizeTitle } from "./shared.server";

export interface MatchSignals {
  /** Which rule produced the base score. */
  rule: "exact" | "contained" | "tokens" | "weak" | "description";
  tokenOverlap: number;
  /** Share of the movie's own words found in the episode title (0-1). */
  coverage: number;
  /** Share of the episode's own words covered by the movie title (0-1). */
  episodeCoverage: number;
  yearMatch: "same" | "near" | "mismatch" | "unknown";
  /** Movie title is a single short word — a common source of false positives. */
  genericTitle: boolean;
  /** Movie title is under 5 characters ("Us", "Men", "Host") — weak evidence alone. */
  shortTitle: boolean;
  /** Movie title is a single very common word ("Girls", "After", "Speed"). */
  commonWord: boolean;
  /** Episode title says it is an interview / mailbag / trailer etc. */
  keywordSuppressed: boolean;
  /** Description hit sat inside promo / cross-plug boilerplate and was ignored. */
  descPromo: boolean;
  /** How many times this movie has been rejected as a match anywhere. */
  rejectedBefore: number;
  /** The movie title appears verbatim in the episode description. */
  descTitle: boolean;
  /** Year agreement between the movie and years mentioned in the description. */
  descYear: "same" | "near" | "mismatch" | "unknown";
  /** Episode names a sequel marker ("II", "3", "Return to") this movie lacks. */
  distinguisherPenalty: boolean;
  /** A longer/better title in the same franchise family beat this candidate. */
  familySuppressed: boolean;
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
  /** Words that appear in a large share of episode titles across the catalogue. */
  commonEpisodeWords?: Set<string> | undefined;
}

const YEAR_RE = /\b(19\d{2}|20\d{2})\b/;
const YEAR_ALL_RE = /\b(19\d{2}|20\d{2})\b/g;
/** Descriptions get long; only the opening is reliably about the episode's subject. */
const DESC_CHARS = 700;

/** Words that carry no identifying weight when comparing titles. */
const STOPWORDS = new Set(["the", "a", "an", "and", "of", "in", "on", "to", "is", "it"]);

/**
 * Single common words that are movie titles but also everyday episode-title words.
 * Matching on these alone produces far more noise than signal.
 */
const COMMON_WORD_TITLES = new Set([
  "girls",
  "boys",
  "after",
  "before",
  "speed",
  "us",
  "them",
  "her",
  "him",
  "men",
  "women",
  "host",
  "lost",
  "friends",
  "up",
  "down",
  "home",
  "love",
  "money",
  "movie",
  "movies",
  "show",
  "shows",
  "hit",
  "cut",
  "help",
  "why",
  "what",
  "hello",
  "goodbye",
  "one",
  "two",
  "trailer",
  "genius",
  "signs",
  "greed",
  "crash",
  "brave",
  "unhinged",
]);

/** Episode-title markers that mean "this is not a film discussion episode". */
const NON_FILM_KEYWORDS = [
  /\binterview(s|ed)?\b/i,
  /\bq\s*&?\s*a\b/i,
  /\bmailbag\b/i,
  /\blisteners?\b/i,
  /\bannouncement\b/i,
  /\btrailer\b/i,
  /\bintroducing\b/i,
  /\blisten now\b/i,
  /\bbonus\b/i,
  /\bpatreon\b/i,
  /\blive show\b/i,
  /\bawards?\b/i,
  /\bhouse ?keeping\b/i,
  /\brecap of the year\b/i,
];

/** Cross-promo boilerplate: a title inside this text is an ad, not the subject. */
const PROMO_MARKERS = [
  "introducing",
  "listen now",
  "wondery",
  "subscribe",
  "new podcast",
  "from the team behind",
  "follow the show",
  "available now",
  "check out",
  "presented by",
  "sponsored",
  "promo code",
  "ad free",
  "ad-free",
];

/** Episode-number / bonus prefixes that dilute a token comparison. */
const EPISODE_PREFIXES = [
  /^ep(isode)?\.?\s*#?\d+\s*[:\-–—|]?\s*/i,
  /^#\d+\s*[:\-–—|]?\s*/,
  /^\d{1,4}\s*[:\-–—|]\s*/,
  /^s\d+\s*e\d+\s*[:\-–—|]?\s*/i,
  /^(bonus|mini(sode)?|patreon|preview|encore|classic|rewatch|revisit|live)\s*[:\-–—|]\s*/i,
];

function stripEpisodePrefixes(title: string): string {
  let out = title.trim();
  for (let i = 0; i < 3; i += 1) {
    let changed = false;
    for (const re of EPISODE_PREFIXES) {
      const next = out.replace(re, "");
      if (next !== out) {
        out = next.trim();
        changed = true;
      }
    }
    if (!changed) break;
  }
  return out;
}

/** `&` reads as "and", so normalise it before token comparison. */
function canonical(input: string): string {
  return normalizeTitle(input.replace(/&/g, " and "));
}

function extractYear(title: string): number | null {
  const m = title.match(YEAR_RE);
  return m ? Number(m[1]) : null;
}

function removeYear(title: string): string {
  return title.replace(YEAR_RE, "").replace(/\s+/g, " ").trim();
}

/** Content words only — stopwords never decide a match. */
function tokenSet(canonicalTitle: string): Set<string> {
  const all = canonicalTitle.split(" ").filter(Boolean);
  const content = all.filter((t) => !STOPWORDS.has(t));
  return new Set(content.length ? content : all);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

/** Single short word ("Genius", "Cats") matches far too many episode titles. */
function isGenericTitle(title: string): boolean {
  const tokens = canonical(title).split(" ").filter(Boolean);
  return tokens.length === 1 && (tokens[0]?.length ?? 0) <= 8;
}

/** Splits the description into sentences so promo copy can be told apart. */
function sentencesContaining(text: string, needle: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => ` ${canonical(s)} `)
    .filter((s) => s.includes(` ${needle} `));
}

export function matchEpisodeToMovies(
  episodeTitle: string,
  movies: { id: string; title: string; release_year: number | null }[],
  options: MatchOptions = {},
): MovieMatchCandidate[] {
  const rejectionCounts = options.rejectionCountByMovie ?? {};
  const commonEpisodeWords = options.commonEpisodeWords ?? new Set<string>();
  const episodeYear = extractYear(episodeTitle);
  const episodeClean = stripEpisodePrefixes(removeYear(episodeTitle));
  const episodeCanonical = canonical(episodeClean);
  const episodeTokens = tokenSet(episodeCanonical);
  const keywordSuppressed = NON_FILM_KEYWORDS.some((re) => re.test(episodeTitle));

  // Description-aware signals: deterministic, no AI, no network.
  const descRaw = (options.description ?? "")
    .replace(/<[^>]*>/g, " ")
    .slice(0, DESC_CHARS);
  const descPadded = descRaw ? ` ${canonical(descRaw)} ` : "";
  const descYears = new Set<number>(
    descRaw ? (descRaw.match(YEAR_ALL_RE) ?? []).map((y) => Number(y)) : [],
  );

  const candidates: MovieMatchCandidate[] = movies.map((movie) => {
    const movieCanonical = canonical(movie.title);
    const movieTokens = tokenSet(movieCanonical);
    const similarity = jaccard(episodeTokens, movieTokens);
    const shared = [...movieTokens].filter((t) => episodeTokens.has(t)).length;
    const coverage = movieTokens.size ? shared / movieTokens.size : 0;

    let confidence = 0;
    let reason = "";
    let rule: MatchSignals["rule"] = "weak";

    // Coverage-first: how much of the *movie* title the episode contains, so
    // extra episode chatter ("Ep 43 - …") no longer dilutes a full match.
    if (episodeCanonical === movieCanonical) {
      confidence = 100;
      reason = "exact title";
      rule = "exact";
    } else if (
      episodeCanonical.includes(` ${movieCanonical} `) ||
      episodeCanonical.startsWith(`${movieCanonical} `) ||
      episodeCanonical.endsWith(` ${movieCanonical}`) ||
      movieCanonical.includes(episodeCanonical)
    ) {
      confidence = 90;
      reason = "title contained";
      rule = "contained";
    } else if (coverage === 1 && movieTokens.size >= 2) {
      confidence = 88;
      reason = "all movie words present";
      rule = "tokens";
    } else if (coverage >= 0.75) {
      confidence = 74;
      reason = "most movie words present";
      rule = "tokens";
    } else if (coverage >= 0.5) {
      confidence = 56;
      reason = "half the movie words present";
      rule = "tokens";
    } else if (similarity >= 0.4) {
      confidence = 50;
      reason = "moderate token overlap";
      rule = "tokens";
    } else {
      confidence = Math.round(coverage * 45);
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
    let descPromo = false;
    let descYear: MatchSignals["descYear"] = "unknown";
    const longEnough = movieCanonical.replace(/ /g, "").length >= 5 || movieTokens.size >= 2;
    if (descPadded && longEnough && !(genericTitle && movieCanonical.length <= 4)) {
      descTitle = descPadded.includes(` ${movieCanonical} `);
      if (descTitle) {
        // Cross-promo copy ("Introducing The Big Flop…") names shows and films
        // that the episode is not about. Ignore hits inside that boilerplate.
        const hits = sentencesContaining(descRaw, movieCanonical);
        const promoOnly =
          hits.length > 0 && hits.every((s) => PROMO_MARKERS.some((marker) => s.includes(marker)));
        if (promoOnly) {
          descTitle = false;
          descPromo = true;
        }
      }
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

    // Very short titles ("Us", "Men", "Host", "Lost") appear inside all sorts of
    // episode titles by accident. Only an exact whole-title match is trustworthy.
    const shortTitle = movieCanonical.replace(/ /g, "").length <= 4;
    if (shortTitle && rule !== "exact") {
      confidence = Math.min(confidence, 15);
      reason += " - very short title";
    }

    // Single common words ("Girls", "After") need corroboration: either the
    // episode year agrees, or the description names the title with its year.
    const onlyToken = movieTokens.size === 1 ? [...movieTokens][0]! : null;
    const commonWord =
      onlyToken !== null &&
      (COMMON_WORD_TITLES.has(onlyToken) || commonEpisodeWords.has(onlyToken));
    if (commonWord && rule !== "exact") {
      const corroborated = yearMatch === "same" || (descTitle && descYear === "same");
      if (!corroborated) {
        confidence = Math.min(confidence, 20);
        reason += " - common word title, unconfirmed";
      }
    }

    // "Interview with…", "Mailbag", "Trailer": weak evidence should not stand.
    if (keywordSuppressed && (rule === "weak" || rule === "description" || coverage < 0.75)) {
      confidence = Math.min(confidence, 15);
      reason += " - episode looks like an interview/bonus";
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
        coverage: Math.round(coverage * 100) / 100,
        yearMatch,
        genericTitle,
        shortTitle,
        commonWord,
        keywordSuppressed,
        descPromo,
        rejectedBefore,
        descTitle,
        descYear,
      },
    };
  });

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.filter((c) => c.confidence >= 25);
}

/**
 * Words appearing in more than `threshold` of episode titles carry no signal —
 * a single-word movie title made of one of them needs corroboration.
 */
export function computeCommonEpisodeWords(
  episodeTitles: string[],
  threshold = 0.01,
): Set<string> {
  const counts = new Map<string, number>();
  for (const title of episodeTitles) {
    const seen = new Set(canonical(title).split(" ").filter(Boolean));
    for (const word of seen) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const min = Math.max(5, Math.ceil(episodeTitles.length * threshold));
  const out = new Set<string>();
  for (const [word, count] of counts) {
    if (count >= min && word.length > 1) out.add(word);
  }
  return out;
}
