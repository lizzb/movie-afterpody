import type {
  Catalog,
  EpisodeRating,
  ListeningStatus,
  Podcast,
  PodcastPreference,
  ProductionQuality,
  UserData,
} from "./types";

/**
 * Deterministic Commentary Score.
 *
 * Explicit rules only — no model calls, no randomness, no network. Weights live
 * in one config object so they can become user-configurable later without a
 * rewrite of the scoring logic itself.
 */
export const SCORE_WEIGHTS = {
  episodeCount: { per: 7, cap: 22 },
  distinctPodcasts: { per: 6, cap: 16 },
  preferredPodcast: { first: 20, extra: 5, cap: 28 },
  lovedEpisode: { per: 9, cap: 16 },
  dislikedEpisode: { per: -8, cap: -16 },
  finishedEpisode: { per: 5, cap: 10 },
  externalRating: { cap: 12 },
  activity: { active: 5, slow: 2, dormant: 0, ended: 0 } as Record<string, number>,
  productionQuality: { good: 3, okay: 0, poor: -3, cap: 5 },
  base: 12,
} as const;

export interface CommentaryScore {
  score: number;
  explanation: string;
  reasons: string[];
  episodeCount: number;
  podcastCount: number;
  preferredCount: number;
}

interface ScoreInputEpisode {
  episodeId: string;
  podcast: Podcast;
  preference: PodcastPreference;
  rating?: EpisodeRating;
  listening?: ListeningStatus;
  quality?: ProductionQuality;
  externalRating: number | null;
  ratingCount: number | null;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function capped(total: number, cap: number) {
  return cap >= 0 ? Math.min(total, cap) : Math.max(total, cap);
}

export function scoreFromEpisodes(episodes: ScoreInputEpisode[]): CommentaryScore {
  const usable = episodes.filter((e) => e.preference !== "blocked");
  if (usable.length === 0) {
    return {
      score: 0,
      explanation: "No commentary episodes catalogued for this one yet.",
      reasons: [],
      episodeCount: 0,
      podcastCount: 0,
      preferredCount: 0,
    };
  }

  const w = SCORE_WEIGHTS;
  const reasons: string[] = [];
  let total = w.base;

  total += capped(usable.length * w.episodeCount.per, w.episodeCount.cap);

  const podcastIds = new Set(usable.map((e) => e.podcast.id));
  total += capped(podcastIds.size * w.distinctPodcasts.per, w.distinctPodcasts.cap);
  if (podcastIds.size > 1) {
    reasons.push(`${podcastIds.size} different podcasts have covered it`);
  } else {
    reasons.push(`${usable.length} commentary episode${usable.length === 1 ? "" : "s"} available`);
  }

  const preferredPodcasts = new Set(
    usable.filter((e) => e.preference === "preferred").map((e) => e.podcast.id),
  );
  if (preferredPodcasts.size > 0) {
    total += capped(
      w.preferredPodcast.first + (preferredPodcasts.size - 1) * w.preferredPodcast.extra,
      w.preferredPodcast.cap,
    );
    const names = usable
      .filter((e) => e.preference === "preferred")
      .map((e) => e.podcast.name)
      .filter((name, i, arr) => arr.indexOf(name) === i);
    reasons.unshift(
      names.length === 1
        ? `${names[0]} is one of your podcasts`
        : `${names.length} of your preferred podcasts covered it`,
    );
  }

  const loved = usable.filter((e) => e.rating === "loved").length;
  if (loved > 0) {
    total += capped(loved * w.lovedEpisode.per, w.lovedEpisode.cap);
    reasons.push(`you loved ${loved} episode${loved === 1 ? "" : "s"} about it`);
  }

  const disliked = usable.filter((e) => e.rating === "disliked").length;
  if (disliked > 0) {
    total += capped(disliked * w.dislikedEpisode.per, w.dislikedEpisode.cap);
    reasons.push(`you didn't enjoy ${disliked} of the episodes`);
  }

  const finished = usable.filter((e) => e.listening === "finished").length;
  if (finished > 0) {
    total += capped(finished * w.finishedEpisode.per, w.finishedEpisode.cap);
    reasons.push(`you finish these podcasts`);
  }

  const rated = usable.filter((e) => e.externalRating !== null);
  if (rated.length > 0) {
    let best = 0;
    let bestName = "";
    for (const e of rated) {
      const rating = e.externalRating ?? 0;
      const count = e.ratingCount ?? 0;
      // 4.0 is the floor of "well liked"; weight by audience size, logarithmically.
      const quality = clamp((rating - 4) / 0.9, 0, 1);
      const reach = clamp(Math.log10(Math.max(count, 1)) / 4.5, 0, 1);
      const value = quality * (0.6 + 0.4 * reach) * w.externalRating.cap;
      if (value > best) {
        best = value;
        bestName = e.podcast.name;
      }
    }
    total += best;
    if (best > w.externalRating.cap * 0.6 && bestName) {
      reasons.push(`${bestName} is very highly rated`);
    }
  }

  const activityBest = Math.max(
    ...usable.map((e) => w.activity[e.podcast.activity_status] ?? 0),
  );
  total += activityBest;

  let qualityTotal = 0;
  for (const e of usable) {
    if (e.quality === "good") qualityTotal += w.productionQuality.good;
    if (e.quality === "poor") qualityTotal += w.productionQuality.poor;
  }
  total += clamp(qualityTotal, -w.productionQuality.cap, w.productionQuality.cap);

  const score = Math.round(clamp(total, 0, 100));
  const explanation = reasons.slice(0, 3).join(", ").replace(/^./, (c) => c.toUpperCase()) + ".";

  return {
    score,
    explanation,
    reasons,
    episodeCount: usable.length,
    podcastCount: podcastIds.size,
    preferredCount: preferredPodcasts.size,
  };
}

/** Builds the score inputs for one movie out of the catalog + the user's own data. */
export function scoreMovie(
  movieId: string,
  catalog: Catalog,
  user: UserData,
): CommentaryScore {
  const podcastById = new Map(catalog.podcasts.map((p) => [p.id, p]));
  const metricByPodcast = new Map(
    catalog.metrics.filter((m) => m.platform === "apple").map((m) => [m.podcast_id, m]),
  );
  const episodeById = new Map(catalog.episodes.map((e) => [e.id, e]));

  const inputs: ScoreInputEpisode[] = [];
  for (const link of catalog.episodeMovies) {
    if (link.movie_id !== movieId) continue;
    const episode = episodeById.get(link.episode_id);
    if (!episode) continue;
    const podcast = podcastById.get(episode.podcast_id);
    if (!podcast) continue;
    const metric = metricByPodcast.get(podcast.id);
    inputs.push({
      episodeId: episode.id,
      podcast,
      preference: user.preferences[podcast.id] ?? "neutral",
      rating: user.ratings[episode.id],
      listening: user.listening[episode.id],
      quality: user.quality[episode.id],
      externalRating: metric?.rating ?? null,
      ratingCount: metric?.rating_count ?? null,
    });
  }
  return scoreFromEpisodes(inputs);
}

/** Ranking score for a podcast in the discovery list — deterministic, same spirit. */
export function scorePodcast(
  podcast: Podcast,
  catalog: Catalog,
  user: UserData,
): { score: number; movieCount: number; reason: string } {
  const episodeIds = new Set(
    catalog.episodes.filter((e) => e.podcast_id === podcast.id).map((e) => e.id),
  );
  const movieIds = new Set(
    catalog.episodeMovies.filter((l) => episodeIds.has(l.episode_id)).map((l) => l.movie_id),
  );
  const metric = catalog.metrics.find((m) => m.podcast_id === podcast.id && m.platform === "apple");
  const preference = user.preferences[podcast.id] ?? "neutral";

  const backlog = clamp(podcast.episode_count / 700, 0, 1) * 22;
  const covered = clamp(movieIds.size / 8, 0, 1) * 22;
  const rating = clamp(((metric?.rating ?? 4) - 4) / 0.9, 0, 1) * 20;
  const reach = clamp(Math.log10(Math.max(metric?.rating_count ?? 1, 1)) / 4.5, 0, 1) * 14;
  const activity = SCORE_WEIGHTS.activity[podcast.activity_status] ?? 0;
  const fit = preference === "preferred" ? 18 : preference === "blocked" ? -40 : 0;

  const reason =
    preference === "preferred"
      ? "One of yours"
      : movieIds.size >= 4
        ? `Covers ${movieIds.size} movies you can stream`
        : podcast.activity_status === "active"
          ? "Posting regularly"
          : "Deep back catalogue";

  return {
    score: Math.round(clamp(backlog + covered + rating + reach + activity + fit, 0, 100)),
    movieCount: movieIds.size,
    reason,
  };
}
