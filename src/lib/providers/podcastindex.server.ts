import { podcastIndexFetch, slugify } from "./shared.server";

export interface PodcastIndexFeed {
  id: number;
  title: string;
  url: string;
  link?: string;
  description?: string;
  author?: string;
  image?: string;
  artwork?: string;
  language?: string;
  categories?: Record<string, string> | number[];
  episodeCount?: number;
  lastUpdateTime?: number;
}

export interface PodcastIndexEpisode {
  id: number;
  title: string;
  feedId?: number;
  feedTitle?: string;
  description?: string;
  link?: string;
  enclosureUrl?: string;
  datePublished?: number;
  duration?: number;
  episodeNumber?: number;
  season?: number;
  guid?: string;
}

export function episodeTitleForStorage(ep: PodcastIndexEpisode): { title: string; fallback: boolean } {
  const title = ep.title?.trim();
  if (title) return { title, fallback: false };
  const suffix = ep.id ? String(ep.id) : ep.guid?.slice(0, 8) || "unknown";
  return { title: `Untitled episode ${suffix}`, fallback: true };
}

export interface PodcastIndexSearchResponse {
  feeds?: PodcastIndexFeed[];
  count?: number;
}

export interface PodcastIndexEpisodesResponse {
  items?: PodcastIndexEpisode[];
  count?: number;
}

export interface PodcastIndexByFeedResponse {
  feed?: PodcastIndexFeed;
}

export async function searchPodcasts(
  apiKey: string,
  apiSecret: string,
  query: string,
  max = 10,
): Promise<PodcastIndexFeed[]> {
  const data = (await podcastIndexFetch(
    `/search/byterm?q=${encodeURIComponent(query)}&max=${max}`,
    apiKey,
    apiSecret,
  )) as PodcastIndexSearchResponse;
  return data.feeds ?? [];
}

export async function searchPodcastsByTitle(
  apiKey: string,
  apiSecret: string,
  title: string,
): Promise<PodcastIndexFeed | null> {
  const feeds = await searchPodcasts(apiKey, apiSecret, title, 5);
  const normalized = title.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const exact = feeds.find((f) => f.title.toLowerCase().trim() === title.toLowerCase().trim());
  if (exact) return exact;

  const scored = feeds.map((f) => {
    const ft = f.title.toLowerCase().replace(/[^a-z0-9\s]/g, "");
    let score = 0;
    if (ft === normalized) score = 100;
    else if (ft.includes(normalized) || normalized.includes(ft)) score = 80;
    else score = Math.max(0, 60 - Math.abs(ft.length - normalized.length));
    return { feed: f, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.score ?? 0 >= 60 ? scored[0]!.feed : null;
}

export async function getPodcastByFeedUrl(
  apiKey: string,
  apiSecret: string,
  feedUrl: string,
): Promise<PodcastIndexFeed | null> {
  const data = (await podcastIndexFetch(
    `/podcasts/byfeedurl?url=${encodeURIComponent(feedUrl)}`,
    apiKey,
    apiSecret,
  )) as PodcastIndexByFeedResponse;
  return data.feed ?? null;
}

export async function getEpisodesByFeedId(
  apiKey: string,
  apiSecret: string,
  feedId: number,
  max = 100,
): Promise<PodcastIndexEpisode[]> {
  const data = (await podcastIndexFetch(
    `/episodes/byfeedid?id=${feedId}&max=${max}`,
    apiKey,
    apiSecret,
  )) as PodcastIndexEpisodesResponse;
  return data.items ?? [];
}

export async function getEpisodesByFeedUrl(
  apiKey: string,
  apiSecret: string,
  feedUrl: string,
  max = 100,
): Promise<PodcastIndexEpisode[]> {
  const data = (await podcastIndexFetch(
    `/episodes/byfeedurl?url=${encodeURIComponent(feedUrl)}&max=${max}`,
    apiKey,
    apiSecret,
  )) as PodcastIndexEpisodesResponse;
  return data.items ?? [];
}

export function podcastSlug(name: string): string {
  return slugify(name);
}

export function episodeSlug(podcastSlug: string, title: string): string {
  const base = slugify(title).slice(0, 60);
  return `${podcastSlug}-${base || "untitled-episode"}`;
}

export function bestArtwork(feed: PodcastIndexFeed): string | null {
  return feed.artwork || feed.image || null;
}
