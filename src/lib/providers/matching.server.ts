import { normalizeTitle } from "./shared.server";
import { parseEpisodeTitle } from "./episode-parse.server";
import { strategyConfig, type MatcherStrategy } from "@/lib/matcher-strategies";


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
  /** Pass U55 — the only shared words came from a guest credit, not the title. */
  guestSuppressed: boolean;
  /** Pass U56 — coverage weighted by how distinctive each shared word is (0-1). */
  weightedCoverage: number;
  /** Pass U56 — a distinctive word of the candidate title is absent from the episode. */
  missingDistinctive: boolean;
  /** Pass U56 — the only shared words sat in post-colon chatter. */
  chatterOnly: boolean;
  /** Pass U57 — the description names the title and its release year in one sentence. */
  descTitleYear: boolean;
  /** Pass U57 — a year agreed but carried no weight: the candidate had no other evidence. */
  yearGated: boolean;
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
  /**
   * Pass U4 — the matcher strategy assigned to this episode's show. Omitted or
   * unknown means the default strategy, i.e. pre-U4 behaviour.
   */
  strategy?: MatcherStrategy | null | undefined;
  /**
   * Pass U56 — catalogue-wide title-word statistics. Supply this when the
   * candidate pool is a small slice of the catalogue; otherwise the pool itself
   * is used.
   */
  titleWordStats?: TitleWordStats | null | undefined;
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
  "big",
  "go",
  "it",
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

/**
 * Sequel markers. When an episode title carries one of these and a candidate
 * movie title does not, that is evidence *against* the candidate — the episode
 * is about the sequel, not the base film.
 */
const DISTINGUISHER_TOKENS = new Set([
  "ii",
  "iii",
  "iv",
  "vi",
  "vii",
  "viii",
  "ix",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "return",
  "returns",
  "part",
  "chapter",
  "revenge",
  "sequel",
  "reloaded",
  "resurrection",
  "resurrections",
  "again",
]);

/** Internal per-candidate bookkeeping for the family post-pass. */
interface ScoredCandidate extends MovieMatchCandidate {
  movieTokens: Set<string>;
  familyKey: string;
  collectionKey: string | null;
}

function isSubset(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

/**
 * Pass U56 — token distinctiveness.
 *
 * Distinctiveness is inverse document frequency over the catalogue's own movie
 * titles, normalised to 0-1: a word that names one film ("Totoro") is worth far
 * more than one that appears in hundreds ("man", "love", "night"). The map is
 * derived from the candidate pool the caller already loaded, cached per array so
 * repeated episode scoring over one pool costs nothing extra.
 */
const IDF_CACHE = new WeakMap<object, { docs: number; df: Map<string, number> }>();

/** A pool this small cannot support meaningful document frequencies. */
const MIN_IDF_DOCS = 40;

function docFrequencies(movies: { title: string }[]): { docs: number; df: Map<string, number> } {
  const cached = IDF_CACHE.get(movies as object);
  if (cached) return cached;
  const df = new Map<string, number>();
  for (const m of movies) {
    for (const token of tokenSet(canonical(m.title))) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }
  const built = { docs: movies.length, df };
  IDF_CACHE.set(movies as object, built);
  return built;
}

/** Catalogue-wide word statistics, so a small candidate pool still scores well. */
export interface TitleWordStats {
  docs: number;
  df: Map<string, number>;
}

/** Builds distinctiveness statistics from a list of catalogue movie titles. */
export function computeTitleWordStats(titles: string[]): TitleWordStats {
  const df = new Map<string, number>();
  for (const title of titles) {
    for (const token of tokenSet(canonical(title))) {
      df.set(token, (df.get(token) ?? 0) + 1);
    }
  }
  return { docs: titles.length, df };
}

/**
 * Word distinctiveness in 0-1. Without a large enough corpus every content word
 * counts the same, so behaviour degrades to pre-U56 coverage rather than to a
 * guess.
 */
function makeDistinctiveness(
  movies: { title: string }[],
  stats: TitleWordStats | null | undefined,
): (word: string) => number {
  const { docs, df } = stats ?? docFrequencies(movies);
  if (docs < MIN_IDF_DOCS) return () => 1;
  const denom = Math.log(docs);
  return (word: string) => {
    const seen = df.get(word) ?? 0;
    const idf = Math.log(docs / (1 + seen)) / denom;
    return Math.min(1, Math.max(0.08, idf));
  };
}

/** Distinctive enough that its absence from the episode title means something. */
const MISSING_IDF_FLOOR = 0.55;

/** Distinctive enough that sharing it is real lexical evidence (Pass U57 gate). */
const IDENTIFYING_IDF = 0.65;

/** Pass U57 — a title named with its release year in one sentence is strong evidence. */
const DESC_TITLE_YEAR_FLOOR = 72;


/** Post-colon chatter still counts, but at a fraction of its face value. */
const CHATTER_WEIGHT = 0.4;




export function matchEpisodeToMovies(
  episodeTitle: string,
  movies: {
    id: string;
    title: string;
    release_year: number | null;
    collection_id?: number | null;
  }[],
  options: MatchOptions = {},
): MovieMatchCandidate[] {
  const cfg = strategyConfig(options.strategy);
  const rejectionCounts = options.rejectionCountByMovie ?? {};
  const commonEpisodeWords = options.commonEpisodeWords ?? new Set<string>();

  const episodeYear = extractYear(episodeTitle);
  // Pass U55 — parse first: guest credits stop counting as title evidence.
  const parsed = parseEpisodeTitle(removeYear(episodeTitle));
  const episodeFullCanonical = canonical(stripEpisodePrefixes(removeYear(episodeTitle)));
  const episodeCanonical = canonical(parsed.titleText);
  const episodeTokens = tokenSet(episodeCanonical);
  // Guest words are tracked only so a guest-only overlap stays explainable.
  const guestTokens = new Set(
    [...tokenSet(canonical(parsed.guestText))].filter((t) => !episodeTokens.has(t)),
  );
  const keywordSuppressed = NON_FILM_KEYWORDS.some((re) => re.test(episodeTitle));
  const episodeDistinguishers = new Set(
    [...episodeTokens].filter((t) => DISTINGUISHER_TOKENS.has(t)),
  );

  // Pass U56 — post-colon chatter. "78. The Broken Hearts Gallery: our favourite
  // break-ups" names the film before the colon; everything after it is talk. Only
  // demote the tail when the head is a plausible title on its own (two or more
  // content words), so "Mission: Impossible II" keeps its whole title.
  const colonSplit = parsed.titleText.split(/\s*:\s*/);
  const headTokens =
    colonSplit.length > 1 ? tokenSet(canonical(colonSplit[0] ?? "")) : episodeTokens;
  const chatterTokens =
    colonSplit.length > 1 && headTokens.size >= 2
      ? new Set([...episodeTokens].filter((t) => !headTokens.has(t)))
      : new Set<string>();

  // Pass U56 — phrase segments of the episode title. A candidate that is only
  // part of a longer phrase ("Friday" inside "Friday Night Lights", "Drive"
  // inside "License to Drive") is a sub-phrase, not the subject.
  const episodePhrases = parsed.titleText
    .split(/[()[\]|,:]|\s[-–—]\s/)
    .map((p) => canonical(p))
    .filter((p) => p.length > 0)
    .map((p) => ({ text: p, tokens: tokenSet(p) }));


  // Pass U56 — distinctiveness of each word across catalogue titles.
  const distinctiveness = makeDistinctiveness(movies, options.titleWordStats);
  const tokenWeight = (t: string) =>
    distinctiveness(t) * (chatterTokens.has(t) ? CHATTER_WEIGHT : 1);


  // Description-aware signals: deterministic, no AI, no network.
  const descRaw = (options.description ?? "")
    .replace(/<[^>]*>/g, " ")
    .slice(0, DESC_CHARS);
  const descPadded = descRaw ? ` ${canonical(descRaw)} ` : "";


  const candidates: ScoredCandidate[] = movies.map((movie) => {
    const movieCanonical = canonical(movie.title);
    const movieTokens = tokenSet(movieCanonical);
    const similarity = jaccard(episodeTokens, movieTokens);
    const sharedTokens = [...movieTokens].filter((t) => episodeTokens.has(t));
    const shared = sharedTokens.length;
    const coverage = movieTokens.size ? shared / movieTokens.size : 0;
    // Symmetric: how much of what the episode names this title accounts for.
    const episodeCoverage = episodeTokens.size ? shared / episodeTokens.size : 0;

    // Pass U56 — the same coverage, weighted by distinctiveness: a shared
    // "broken" is worth much less than a shared "totoro", and words that sat in
    // post-colon chatter count at a fraction of face value.
    const movieWeightTotal = [...movieTokens].reduce((sum, t) => sum + distinctiveness(t), 0);
    const sharedWeight = sharedTokens.reduce((sum, t) => sum + tokenWeight(t), 0);
    const weightedCoverage = movieWeightTotal ? sharedWeight / movieWeightTotal : 0;
    const chatterOnly = shared > 0 && sharedTokens.every((t) => chatterTokens.has(t));
    // The missing side: a distinctive word of the candidate's own title that the
    // episode never says ("arrow" in "Broken Arrow") is evidence against it.
    // Words after a colon in the *movie* title are structurally omittable, so a
    // subtitle-only omission is exempt.
    const movieSubtitleTokens =
      movie.title.includes(":")
        ? new Set(
            [...tokenSet(canonical(movie.title.split(/\s*:\s*/).slice(1).join(" ")))],
          )
        : new Set<string>();
    const missingWeights = [...movieTokens]
      .filter((t) => !episodeTokens.has(t) && !movieSubtitleTokens.has(t))
      .map((t) => distinctiveness(t));
    const worstMissing = missingWeights.length ? Math.max(...missingWeights) : 0;
    /** How identifying the evidence the episode actually gives us is. */
    const sharedMax = sharedTokens.length
      ? Math.max(...sharedTokens.map((t) => tokenWeight(t)))
      : 0;



    // Distinctiveness never inflates a match, only tempers a generic one.
    const effCoverage = Math.min(coverage, weightedCoverage);

    let confidence = 0;
    let reason = "";
    let rule: MatchSignals["rule"] = "weak";

    // Coverage-first: how much of the *movie* title the episode contains, so
    // extra episode chatter ("Ep 43 - …") no longer dilutes a full match.
    // A whole-title match on the *unparsed* string still counts, so a real
    // title containing "with" is never broken by the parse stage.
    if (episodeCanonical === movieCanonical || episodeFullCanonical === movieCanonical) {
      confidence = 100;
      reason = "exact title";
      rule = "exact";
    } else if (
      episodeCanonical.includes(` ${movieCanonical} `) ||
      episodeCanonical.startsWith(`${movieCanonical} `) ||
      episodeCanonical.endsWith(` ${movieCanonical}`) ||
      // Pass U57 — a very short or empty episode title ("π") is contained in
      // every movie title as a string; that is not containment evidence.
      (episodeCanonical.length >= 4 && movieCanonical.includes(episodeCanonical))
    ) {

      confidence = 90;
      reason = "title contained";
      rule = "contained";
    } else if (coverage === 1 && movieTokens.size >= 2) {
      confidence = 88;
      reason = "all movie words present";
      rule = "tokens";
    } else if (effCoverage >= 0.75) {
      confidence = 74;
      reason = "most movie words present";
      rule = "tokens";
    } else if (effCoverage >= 0.5) {
      confidence = 56;
      reason = "half the movie words present";
      rule = "tokens";
    } else if (similarity >= 0.4 && weightedCoverage >= 0.4) {
      confidence = 50;
      reason = "moderate token overlap";
      rule = "tokens";
    } else {
      confidence = Math.round(effCoverage * 45);
      reason = "token overlap";
      rule = "weak";
    }

    // Pass U57 — the description is *read* before the year is scored, because the
    // year gate has to know whether this candidate has any evidence at all.
    const genericTitle = isGenericTitle(movie.title);
    let descTitle = false;
    let descPromo = false;
    let descYear: MatchSignals["descYear"] = "unknown";
    let descTitleYear = false;
    /** Years appearing in the same sentence as the title mention (Pass U57). */
    const descSentenceYears = new Set<number>();
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
        } else {
          // Pass U57 — only a year sitting beside the mention says anything about
          // *this* film; a year somewhere else in long show notes does not.
          for (const s of hits) {
            for (const y of s.match(YEAR_ALL_RE) ?? []) descSentenceYears.add(Number(y));
          }
        }
      }
    }

    // Pass U57 — the year gate. A release year is a tie-breaker, never evidence
    // on its own: "π (1998)" must not lift every unrelated 1998 film. The
    // candidate needs non-generic lexical evidence (an exact/contained hit, full
    // coverage, or a distinctive shared word) or a description mention first.
    const lexicalEvidence =
      rule === "exact" ||
      (shared > 0 &&
        (rule === "contained" ||
          coverage === 1 ||
          (weightedCoverage >= 0.5 && sharedMax >= IDENTIFYING_IDF)));
    const yearGated = !lexicalEvidence && !descTitle;


    // Year bonus/penalty (weights come from the show's strategy; the default
    // strategy uses the pre-U4 values).
    let yearMatch: MatchSignals["yearMatch"] = "unknown";
    if (movie.release_year && episodeYear) {
      if (movie.release_year === episodeYear) {
        yearMatch = "same";
        if (yearGated) {
          reason += " (year ignored - nothing else points to this film)";
        } else {
          confidence = Math.min(100, confidence + cfg.yearBonus);
          reason += " + year match";
        }
      } else if (Math.abs(movie.release_year - episodeYear) <= 1) {
        yearMatch = "near";
        if (yearGated) {
          reason += " (year ignored - nothing else points to this film)";
        } else {
          confidence = Math.min(100, confidence + cfg.yearNearBonus);
          reason += " + year near";
        }
      } else {
        yearMatch = "mismatch";
        if (confidence < cfg.yearMismatchCeiling) {
          confidence = Math.max(0, confidence - cfg.yearMismatchPenalty);
          reason += " - year mismatch";
        }
      }
    }


    // Learned penalties: generic one-word titles and movies rejected before.
    if (genericTitle && rule !== "exact") {
      confidence = Math.max(0, confidence - 12);
      reason += " - generic title";
    }

    // Description-aware evidence: the show notes usually name the film outright,
    // often with its release year, even when the episode title is a pun.
    if (descTitle) {
      const release = movie.release_year;
      const sentenceYearSame = Boolean(release && descSentenceYears.has(release));
      const sentenceYearNear =
        !sentenceYearSame &&
        Boolean(release && [...descSentenceYears].some((y) => Math.abs(y - release) <= 1));

      if (rule === "weak") {
        // Pass U57 — a title named with its own release year in one sentence is
        // strictly stronger than a bare mention, and outranks generic overlap.
        const floor = sentenceYearSame
          ? DESC_TITLE_YEAR_FLOOR
          : genericTitle
            ? cfg.descriptionOnlyGenericFloor
            : cfg.descriptionOnlyFloor;
        confidence = Math.max(confidence, floor);
        reason = sentenceYearSame
          ? "named in description with its release year"
          : "named in description";
        rule = "description";
      } else {
        confidence = Math.min(100, confidence + cfg.descriptionBonus);
        reason += " + named in description";
      }

      if (release && descSentenceYears.size > 0) {
        if (sentenceYearSame) {
          confidence = Math.min(100, confidence + cfg.yearBonus);
          reason += " + year in description";
          descYear = "same";
          descTitleYear = true;
        } else if (sentenceYearNear) {
          confidence = Math.min(100, confidence + cfg.yearNearBonus);
          reason += " + year near in description";
          descYear = "near";
        } else {
          descYear = "mismatch";
          if (rule === "description") {
            confidence = Math.max(0, confidence - 8);
            reason += " - year beside the mention is a different film";
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
    const singleMovieToken = [...movieTokens][0];
    const onlyToken = movieTokens.size === 1 && singleMovieToken ? singleMovieToken : null;
    const commonWord =
      onlyToken !== null &&
      (COMMON_WORD_TITLES.has(onlyToken) || commonEpisodeWords.has(onlyToken));
    if (commonWord && rule !== "exact") {
      const corroborated = yearMatch === "same" || (descTitle && descYear === "same");
      const titleOnlyContainsCommonWord = rule === "contained" && episodeCoverage < 0.5;
      if (!corroborated || titleOnlyContainsCommonWord) {
        confidence = Math.min(confidence, 20);
        reason += " - common word title, unconfirmed";
      }
    }

    // Pass U16 — "live" on its own is show-format language ("live show",
    // "live at the Bell House", "live from Chicago"), not a title token. A
    // match whose only shared word is "live" needs corroboration; real titles
    // that merely contain "Live" (Live Free or Die Hard) share other words too.
    const sharedTokenList = [...movieTokens].filter((t) => episodeTokens.has(t));
    const hingesOnLive =
      rule !== "exact" &&
      ((sharedTokenList.length > 0 && sharedTokenList.every((t) => t === "live")) ||
        onlyToken === "live");
    if (hingesOnLive) {
      const corroborated = yearMatch === "same" || (descTitle && descYear === "same");
      if (!corroborated) {
        confidence = Math.min(confidence, 15);
        reason += " - hinges on the word \"live\"";
      }
    }

    // Pass U4, "Special-word suppression" strategy: a single generic word gets
    // the same corroboration requirement the common-word rule already applies.
    if (cfg.suppressGenericWithoutCorroboration && genericTitle && rule !== "exact") {
      const corroborated = yearMatch === "same" || (descTitle && descYear !== "mismatch");
      if (!corroborated) {
        confidence = Math.min(confidence, 20);
        reason += " - one-word title, unconfirmed";
      }
    }

    // Pass U4, "Actor/name corroboration" strategy: reuses the existing
    // description-corroboration rule as a hard requirement — a title hit that
    // the show notes never name (and whose year does not agree) is capped.
    if (cfg.requireCorroboration && rule !== "exact") {
      const corroborated = yearMatch === "same" || descTitle;
      if (!corroborated) {
        confidence = Math.min(confidence, cfg.uncorroboratedCap);
        reason += " - not corroborated by show notes";
      }
    }




    // "Interview with…", "Mailbag", "Trailer": weak evidence should not stand.
    if (keywordSuppressed && (rule === "weak" || rule === "description" || coverage < 0.75)) {
      confidence = Math.min(confidence, 15);
      reason += " - episode looks like an interview/bonus";
    }

    // Sequel markers the candidate lacks ("Halloweentown" against "…town II").
    let distinguisherPenalty = false;
    if (episodeDistinguishers.size > 0 && rule !== "exact") {
      const missing = [...episodeDistinguishers].filter((t) => !movieTokens.has(t));
      if (missing.length > 0 && coverage >= 0.5) {
        distinguisherPenalty = true;
        confidence = Math.max(0, confidence - 12);
        reason += ` - episode says "${missing[0]}", title does not`;
      }
    }

    // Symmetric coverage: a base title that only accounts for a small slice of
    // what the episode names is weaker than one that accounts for all of it.
    if (rule === "tokens" && coverage < 1 && episodeCoverage < 0.34) {
      confidence = Math.max(0, confidence - 5);
      reason += " - covers little of the episode title";
    }

    // Pass U55 — the candidate's overlap comes from the guest credit, not the
    // title ("Road to Perdition with Blake Howard" vs "Howard the Duck").
    const guestOverlap = [...movieTokens].filter((t) => guestTokens.has(t)).length;
    const guestSuppressed = guestOverlap > 0 && coverage < 1 && rule !== "exact";
    if (guestSuppressed) {
      confidence = Math.min(confidence, 15);
      reason += " - only matches the guest's name";
    }

    // Pass U56 — a distinctive word of the candidate's own title that the episode
    // never says is negative evidence, scaled by how distinctive that word is.
    // An exact hit accounts for the whole title, so it is exempt.
    const corroboratedU56 = yearMatch === "same" || (descTitle && descYear !== "mismatch");
    const missingDistinctive =
      worstMissing >= MISSING_IDF_FLOOR && coverage < 1 && rule !== "exact";
    if (missingDistinctive) {
      // Half a title's words, one of them distinctive and absent, is not
      // evidence of anything: "Purple Rain" against "Harold and the Purple
      // Crayon", "Return of the Jedi" against "Return to Silent Hill". Same when
      // the word the episode omits is more identifying than anything it says:
      // "Falling for Figaro" against "Falling for You".
      const missingDominates = worstMissing > sharedMax;
      const weakTokens = rule === "tokens" && (coverage <= 0.5 || missingDominates);
      // The episode says less than the candidate's title and what it leaves out
      // is more identifying than what it says: "The Parent Trap" for "Trap".
      const weakContainment = rule === "contained" && missingDominates;
      if ((weakTokens || weakContainment) && !corroboratedU56) {
        confidence = Math.min(confidence, 20);
      } else {
        confidence = Math.max(0, confidence - Math.round(worstMissing * 22));
      }
      reason += " - title has a distinctive word the episode never says";
    }

    // Pass U56 — distinctive beats generic: a candidate that is only part of a
    // longer phrase in the episode title is a sub-phrase, not the subject
    // ("Friday" in "Friday Night Lights", "Drive" in "License to Drive"). The
    // extra words have to carry weight of their own, so ordinary chatter around
    // a real title ("Magnolia (Dads Can Be Very a Lot)") still matches.
    let subPhrase = false;
    if (rule === "contained" && coverage === 1 && !corroboratedU56) {
      const host = episodePhrases.find(
        (p) => p.tokens.size > movieTokens.size && isSubset(movieTokens, p.tokens),
      );
      if (host) {
        const extras = [...host.tokens].filter((t) => !movieTokens.has(t));
        subPhrase = extras.some(
          (t) =>
            distinctiveness(t) >= MISSING_IDF_FLOOR &&
            !commonEpisodeWords.has(t) &&
            !COMMON_WORD_TITLES.has(t),
        );
      }
      if (subPhrase) {
        confidence = Math.min(confidence, 20);
        reason += " - only part of a longer title in the episode";
      }
    }

    // Pass U56 — the shared words all sat in post-colon chatter, not in the
    // part of the episode title that names the film.
    if (chatterOnly && rule !== "exact" && coverage < 1) {
      confidence = Math.min(confidence, 18);
      reason += " - only matches post-colon chatter";
    }

    const familyKey = [...movieTokens][0] ?? movieCanonical;

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
        episodeCoverage: Math.round(episodeCoverage * 100) / 100,
        yearMatch,
        genericTitle,
        shortTitle,
        commonWord,
        keywordSuppressed,
        descPromo,
        rejectedBefore,
        descTitle,
        descYear,
        distinguisherPenalty,
        familySuppressed: false,
        guestSuppressed,
        weightedCoverage: Math.round(weightedCoverage * 100) / 100,
        missingDistinctive,
        chatterOnly,
        descTitleYear,
        yearGated,

      },
      movieTokens,
      familyKey,
      collectionKey: movie.collection_id ? `c${movie.collection_id}` : null,
    };
  });

  // Pass U56 — the episode title names a film outright, so a longer title that
  // merely contains that text ("The Parent Trap" for the episode "Trap") is not
  // in the running.
  if (candidates.some((c) => c.signals.rule === "exact")) {
    for (const c of candidates) {
      if (c.signals.rule === "contained" && c.signals.coverage < 1) {
        c.confidence = Math.min(c.confidence, 20);
        c.reason += " - the episode names another film exactly";
      }
    }
  }

  resolveFamilies(candidates, episodeDistinguishers);

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates
    .filter((c) => c.confidence >= cfg.suggestionFloor)

    .map(({ movieTokens: _t, familyKey: _f, collectionKey: _c, ...rest }) => rest);
}

/** Best-first ordering inside a franchise family. */
function betterInFamily(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  if (b.signals.coverage !== a.signals.coverage) return b.signals.coverage - a.signals.coverage;
  if (b.signals.episodeCoverage !== a.signals.episodeCoverage) {
    return b.signals.episodeCoverage - a.signals.episodeCoverage;
  }
  const rank = (c: ScoredCandidate) =>
    c.signals.yearMatch === "same" ? 2 : c.signals.yearMatch === "near" ? 1 : 0;
  return rank(b) - rank(a);
}

function suppress(candidate: ScoredCandidate, winner: ScoredCandidate) {
  if (candidate.signals.rule === "exact") return;
  candidate.confidence = Math.min(candidate.confidence, 20);
  candidate.signals.familySuppressed = true;
  candidate.reason += ` - superseded by "${winner.title}"`;
}

/**
 * Franchise disambiguation. Sequels whose titles contain the original all match
 * the base film, so within a family only the most specific title survives.
 * Mutates the candidates in place.
 */
function resolveFamilies(candidates: ScoredCandidate[], episodeDistinguishers: Set<string>) {
  // 1. Title-stem families: the most specific title wins. Built without a score
  //    floor so a low-scoring sequel can still argue against the base film.
  const byStem = new Map<string, ScoredCandidate[]>();
  for (const c of candidates) {
    const list = byStem.get(c.familyKey) ?? [];
    list.push(c);
    byStem.set(c.familyKey, list);
  }
  for (const group of byStem.values()) {
    if (group.length < 2) continue;

    // The episode names a sequel marker and a family sibling carries it: that
    // sibling is the subject, so shorter titles without the marker stand aside.
    if (episodeDistinguishers.size > 0) {
      const marked = group.filter((c) =>
        [...episodeDistinguishers].some((t) => c.movieTokens.has(t)),
      );
      for (const sibling of marked) {
        for (const c of group) {
          if (c === sibling || marked.includes(c)) continue;
          // Subset only: "Halloweentown" inside "Halloweentown II: …".
          if (isSubset(c.movieTokens, sibling.movieTokens)) suppress(c, sibling);
        }
      }
    }


    // Longest fully-covered title wins; anything whose words are a subset of it
    // is a less specific match for the same episode.
    const live = group.filter((c) => c.confidence >= 25);
    const covered = live.filter((c) => c.signals.coverage === 1);
    if (!covered.length) continue;
    const winner = [...covered].sort((a, b) => {
      if (b.movieTokens.size !== a.movieTokens.size) return b.movieTokens.size - a.movieTokens.size;
      return betterInFamily(a, b);
    })[0];
    if (!winner) continue;
    for (const c of live) {
      if (c === winner) continue;
      // An exact whole-title hit settles the family outright.
      if (winner.signals.rule === "exact" || isSubset(c.movieTokens, winner.movieTokens)) {
        suppress(c, winner);
      }
    }
  }

  // 2. TMDB collections: same franchise, so only the best-scoring entry stands.
  const byCollection = new Map<string, ScoredCandidate[]>();
  for (const c of candidates) {
    if (!c.collectionKey || c.confidence < 25) continue;
    const list = byCollection.get(c.collectionKey) ?? [];
    list.push(c);
    byCollection.set(c.collectionKey, list);
  }
  for (const group of byCollection.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(betterInFamily);
    const winner = sorted[0];
    if (!winner) continue;
    for (const c of sorted.slice(1)) suppress(c, winner);
  }
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
