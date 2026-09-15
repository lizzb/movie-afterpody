/**
 * Pass R3 — "Score the matcher".
 *
 * Replays the current scoring rules over the labels admins have already
 * produced (approve / confirm = positive, reject / retire = negative) and
 * reports precision, recall and where the mistakes cluster. Database only:
 * no TMDB calls, no AI, no tokens.
 */
import {
  matchEpisodeToMovies,
  computeCommonEpisodeWords,
  computeTitleWordStats,
} from "./providers/matching.server";
import { pageAll, fetchRejectionCountsByMovie } from "./ingestion-helpers.server";
import {
  asMatcherStrategy,
  strategyConfig,
  DEFAULT_MATCHER_STRATEGY,
  type MatcherStrategy,
} from "./matcher-strategies";
import type { supabaseAdmin as Admin } from "@/integrations/supabase/client.server";


type AdminClient = typeof Admin;

export interface BandStat {
  band: string;
  min: number;
  max: number;
  positives: number;
  negatives: number;
  /** positives / (positives + negatives) inside the band. */
  precision: number | null;
}

export interface SignalStat {
  signal: string;
  positiveRate: number;
  negativeRate: number;
  /** positiveRate - negativeRate: above 0 the signal predicts a good match. */
  lift: number;
  positives: number;
  negatives: number;
}

export interface MatcherReport {
  labelledPairs: number;
  positives: number;
  negatives: number;
  scored: number;
  unscored: number;
  /** Precision/recall at the live suggestion threshold for the scored strategy. */
  threshold: number;
  precisionAtThreshold: number | null;
  recallAtThreshold: number | null;
  bands: BandStat[];
  /** Band holding the largest share of wrong-but-suggested pairs. */
  worstBand: string | null;
  signals: SignalStat[];
  meanConfidencePositive: number | null;
  meanConfidenceNegative: number | null;
  generatedAt: string;
  /**
   * Pass U4 — the strategy this run scored with. Null means "each show's own
   * assigned strategy", i.e. exactly what the live matcher would do.
   */
  strategy: MatcherStrategy | null;
  /** Pass U4 — the single show scored, when the run was scoped to one. */
  podcastId: string | null;
}

export interface EvaluateOptions {
  /** Score every labelled pair as if this strategy were assigned everywhere. */
  strategy?: MatcherStrategy | null;
  /** Restrict the labels to one show. */
  podcastId?: string | null;
}


const BANDS: { band: string; min: number; max: number }[] = [
  { band: "0–24 (below threshold)", min: 0, max: 24 },
  { band: "25–39", min: 25, max: 39 },
  { band: "40–54", min: 40, max: 54 },
  { band: "55–69", min: 55, max: 69 },
  { band: "70–79", min: 70, max: 79 },
  { band: "80–89", min: 80, max: 89 },
  { band: "90–100", min: 90, max: 100 },
];

const THRESHOLD = 25;

/** Boolean-ish signals worth measuring against the labels. */
const SIGNAL_TESTS: { signal: string; test: (s: Record<string, unknown>) => boolean }[] = [
  { signal: "exact title", test: (s) => s["rule"] === "exact" },
  { signal: "title contained", test: (s) => s["rule"] === "contained" },
  { signal: "token/coverage rule", test: (s) => s["rule"] === "tokens" },
  { signal: "weak rule", test: (s) => s["rule"] === "weak" },
  { signal: "description-only rule", test: (s) => s["rule"] === "description" },
  { signal: "full movie-title coverage", test: (s) => Number(s["coverage"] ?? 0) >= 1 },
  { signal: "named in description", test: (s) => s["descTitle"] === true },
  { signal: "year agrees", test: (s) => s["yearMatch"] === "same" },
  { signal: "year mismatch", test: (s) => s["yearMatch"] === "mismatch" },
  { signal: "generic one-word title", test: (s) => s["genericTitle"] === true },
  { signal: "very short title", test: (s) => s["shortTitle"] === true },
  { signal: "common-word title", test: (s) => s["commonWord"] === true },
  { signal: "interview/bonus keyword", test: (s) => s["keywordSuppressed"] === true },
  { signal: "description hit was promo", test: (s) => s["descPromo"] === true },
  { signal: "rejected before", test: (s) => Number(s["rejectedBefore"] ?? 0) > 0 },
  { signal: "sequel marker missing from title", test: (s) => s["distinguisherPenalty"] === true },
  { signal: "beaten by a franchise sibling", test: (s) => s["familySuppressed"] === true },
  { signal: "matched only the guest's name", test: (s) => s["guestSuppressed"] === true },
  {
    signal: "title has a distinctive word the episode never says",
    test: (s) => s["missingDistinctive"] === true,
  },
  { signal: "matched only post-colon chatter", test: (s) => s["chatterOnly"] === true },
  { signal: "named in description with its year", test: (s) => s["descTitleYear"] === true },
  { signal: "year ignored (no other evidence)", test: (s) => s["yearGated"] === true },
  { signal: "episode predates the film's release", test: (s) => s["preRelease"] === "early" },
  { signal: "episode just before release", test: (s) => s["preRelease"] === "window" },
  {
    signal: "episode names a numbered entry this film is not",
    test: (s) => s["sequelMismatch"] === true,
  },
  { signal: "matched only a subtitle", test: (s) => s["subtitleOnly"] === true },
  {
    signal: "show notes describe this as something other than a film",
    test: (s) => s["contentTypeMismatch"] === true,
  },
  { signal: "episode title names a television episode", test: (s) => s["tvDesignator"] === true },
  { signal: "list/ranking episode", test: (s) => s["listEpisode"] === true },
  { signal: "matched only a show-format word", test: (s) => s["formatWordOnly"] === true },
  {
    signal: "one of several films named in the episode title",
    test: (s) => s["multiTitle"] === true,
  },



  {
    signal: "shared words are distinctive",
    test: (s) => Number(s["weightedCoverage"] ?? 0) >= 0.75,
  },
  { signal: "covers most of the episode title", test: (s) => Number(s["episodeCoverage"] ?? 0) >= 0.5 },
];


export async function evaluateMatcher(
  admin: AdminClient,
  opts: EvaluateOptions = {},
): Promise<MatcherReport> {
  const override = opts.strategy ?? null;
  const podcastFilter = opts.podcastId ?? null;
  // Labels. Positives come from the action log (approve/confirm); negatives from
  // the rejection table, which also absorbs "not about a movie" retirements.
  const [actions, rejections, rejectionCountByMovie, podcastStrategies] = await Promise.all([
    pageAll<{ action: string; episode_id: string; movie_id: string | null; undone_at: string | null }>(
      (from, to) =>
        admin
          .from("match_actions")
          .select("action, episode_id, movie_id, undone_at")
          .in("action", ["approve", "confirm", "reject"])
          .is("undone_at", null)
          .range(from, to),
    ),
    pageAll<{ episode_id: string; movie_id: string }>((from, to) =>
      admin.from("episode_match_rejections").select("episode_id, movie_id").range(from, to),
    ),
    fetchRejectionCountsByMovie(admin),
    // Pass U4 — each show's assigned strategy, so a default run reproduces the
    // live matcher exactly and a scoped run can be compared against it.
    pageAll<{ id: string; matcher_strategy: string }>((from, to) =>
      admin.from("podcasts").select("id, matcher_strategy").range(from, to),
    ),
  ]);
  const strategyByPodcast = new Map(
    podcastStrategies.map((p) => [p.id, asMatcherStrategy(p.matcher_strategy)]),
  );

  const label = new Map<string, boolean>();
  for (const r of rejections) label.set(`${r.episode_id}:${r.movie_id}`, false);
  for (const a of actions) {
    if (!a.movie_id) continue;
    const key = `${a.episode_id}:${a.movie_id}`;
    if (a.action === "reject") {
      if (!label.has(key)) label.set(key, false);
    } else {
      // A human approval outranks an earlier rejection of the same pair.
      label.set(key, true);
    }
  }

  const episodeIds = [...new Set([...label.keys()].map((k) => k.split(":")[0]!))];
  const movieIds = [...new Set([...label.keys()].map((k) => k.split(":")[1]!))];

  const [episodes, movies, allTitles, allMovieTitles] = await Promise.all([
    chunkedIn<{
      id: string;
      title: string;
      description: string | null;
      released_at: string | null;
      podcast_id: string;
    }>(episodeIds, (ids) =>
      admin
        .from("podcast_episodes")
        .select("id, title, description, released_at, podcast_id")
        .in("id", ids),
    ),
    chunkedIn<{
      id: string;
      title: string;
      release_year: number | null;
      release_date: string | null;
      collection_id: number | null;
    }>(movieIds, (ids) =>
      admin
        .from("movies")
        .select("id, title, release_year, release_date, collection_id")
        .in("id", ids),
    ),
    pageAll<{ title: string }>((from, to) =>
      admin.from("podcast_episodes").select("title").range(from, to),
    ),
    // Pass U56 — word distinctiveness is a property of the whole catalogue, not
    // of the few labelled candidates each episode is scored against.
    pageAll<{ title: string }>((from, to) => admin.from("movies").select("title").range(from, to)),
  ]);

  const commonEpisodeWords = computeCommonEpisodeWords(allTitles.map((t) => t.title));
  const titleWordStats = computeTitleWordStats(allMovieTitles.map((t) => t.title));
  const movieById = new Map(movies.map((m) => [m.id, m]));
  const episodeById = new Map(
    episodes
      .filter((e) => !podcastFilter || e.podcast_id === podcastFilter)
      .map((e) => [e.id, e]),
  );


  const bandCounts = BANDS.map((b) => ({ ...b, positives: 0, negatives: 0 }));
  const signalCounts = SIGNAL_TESTS.map((s) => ({ ...s, positives: 0, negatives: 0 }));

  let positives = 0;
  let negatives = 0;
  let scored = 0;
  let unscored = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let sumPos = 0;
  let sumNeg = 0;
  // Pass U4 — the suggestion floor of the strategy being scored.
  const threshold = override ? strategyConfig(override).suggestionFloor : THRESHOLD;

  // Group by episode so each episode is scored once against its labelled movies.
  const byEpisode = new Map<string, { movieId: string; positive: boolean }[]>();
  let labelledPairs = 0;
  for (const [key, positive] of label) {
    const [episodeId, movieId] = key.split(":") as [string, string];
    // A scoped run only counts labels belonging to the chosen show.
    if (podcastFilter && !episodeById.has(episodeId)) continue;
    labelledPairs += 1;
    const list = byEpisode.get(episodeId) ?? [];
    list.push({ movieId, positive });
    byEpisode.set(episodeId, list);
  }

  for (const [episodeId, pairs] of byEpisode) {
    const episode = episodeById.get(episodeId);
    if (!episode) {
      unscored += pairs.length;
      continue;
    }
    const candidateMovies = pairs
      .map((p) => movieById.get(p.movieId))
      .filter((m): m is { id: string; title: string; release_year: number | null; release_date: string | null; collection_id: number | null } => Boolean(m));

    // Pass U4 — score with the override strategy, or with the show's own.
    const strategy =
      override ?? strategyByPodcast.get(episode.podcast_id) ?? DEFAULT_MATCHER_STRATEGY;
    const scores = matchEpisodeToMovies(episode.title, candidateMovies, {
      rejectionCountByMovie,
      description: episode.description,
      commonEpisodeWords,
      titleWordStats,
      strategy,
      // Pass U73 — temporal sanity uses the episode's publication date.
      episodeReleasedAt: episode.released_at,
    });

    const byMovie = new Map(scores.map((c) => [c.movieId, c]));

    for (const pair of pairs) {
      if (pair.positive) positives += 1;
      else negatives += 1;

      const candidate = byMovie.get(pair.movieId);
      // matchEpisodeToMovies drops anything under the suggestion threshold, so a
      // missing candidate means "scored below 25" — still a data point.
      const confidence = candidate?.confidence ?? 0;
      if (!movieById.has(pair.movieId)) {
        unscored += 1;
        continue;
      }
      scored += 1;

      if (pair.positive) sumPos += confidence;
      else sumNeg += confidence;

      const band = bandCounts.find((b) => confidence >= b.min && confidence <= b.max);
      if (band) {
        if (pair.positive) band.positives += 1;
        else band.negatives += 1;
      }

      if (confidence >= threshold) {
        if (pair.positive) tp += 1;
        else fp += 1;
      } else if (pair.positive) {
        fn += 1;
      }

      const signals = (candidate?.signals ?? null) as Record<string, unknown> | null;
      if (signals) {
        for (const s of signalCounts) {
          if (!s.test(signals)) continue;
          if (pair.positive) s.positives += 1;
          else s.negatives += 1;
        }
      }
    }
  }

  const bands: BandStat[] = bandCounts.map((b) => ({
    band: b.band,
    min: b.min,
    max: b.max,
    positives: b.positives,
    negatives: b.negatives,
    precision: b.positives + b.negatives > 0 ? b.positives / (b.positives + b.negatives) : null,
  }));

  // Where the wrong-but-suggested pairs pile up: the band worth re-tuning next.
  const suggestedBands = bands.filter((b) => b.min >= threshold && b.negatives > 0);
  const worstBand =
    suggestedBands.sort((a, b) => b.negatives - a.negatives)[0]?.band ?? null;

  const signals: SignalStat[] = signalCounts
    .filter((s) => s.positives + s.negatives > 0)
    .map((s) => {
      const positiveRate = positives > 0 ? s.positives / positives : 0;
      const negativeRate = negatives > 0 ? s.negatives / negatives : 0;
      return {
        signal: s.signal,
        positiveRate,
        negativeRate,
        lift: positiveRate - negativeRate,
        positives: s.positives,
        negatives: s.negatives,
      };
    })
    .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift));

  return {
    labelledPairs,
    positives,
    negatives,
    scored,
    unscored,
    threshold,
    precisionAtThreshold: tp + fp > 0 ? tp / (tp + fp) : null,
    recallAtThreshold: tp + fn > 0 ? tp / (tp + fn) : null,
    bands,
    worstBand,
    signals,
    meanConfidencePositive: positives > 0 ? sumPos / positives : null,
    meanConfidenceNegative: negatives > 0 ? sumNeg / negatives : null,
    generatedAt: new Date().toISOString(),
    strategy: override,
    podcastId: podcastFilter,
  };
}

/** `.in()` on thousands of ids blows the URL limit — chunk it. */
async function chunkedIn<T>(
  ids: string[],
  fetchChunk: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await fetchChunk(ids.slice(i, i + 200));
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}
