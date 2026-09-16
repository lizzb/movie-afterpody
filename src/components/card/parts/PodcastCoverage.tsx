import { Artwork } from "@/components/Artwork";
import type { EpisodeEntry } from "@/lib/discovery";

/** Distinct podcasts covering this movie, preferred shows first. */
export function coveringPodcasts(episodes: EpisodeEntry[]) {
  const byId = new Map<
    string,
    {
      id: string;
      slug: string;
      name: string;
      artwork: string | null;
      accent: string;
      preferred: boolean;
      count: number;
    }
  >();
  for (const ep of episodes) {
    const existing = byId.get(ep.podcast.id);
    if (existing) {
      existing.count += 1;
      existing.preferred = existing.preferred || ep.preferred;
      continue;
    }
    byId.set(ep.podcast.id, {
      id: ep.podcast.id,
      slug: ep.podcast.slug,
      name: ep.podcast.name,
      artwork: ep.podcast.artwork_url,
      accent: ep.podcast.accent,
      preferred: ep.preferred,
      count: 1,
    });
  }
  return [...byId.values()].sort(
    (a, b) => Number(b.preferred) - Number(a.preferred) || b.count - a.count,
  );
}

/** Podcast coverage: cover-art circles plus a concise count. */
export function PodcastCoverage({
  episodes,
  verbose = false,
}: {
  episodes: EpisodeEntry[];
  verbose?: boolean;
}) {
  const shows = coveringPodcasts(episodes);
  if (shows.length === 0) {
    return <p className="text-[11px] text-muted-foreground">No commentary episodes yet</p>;
  }

  const summary = verbose
    ? `${episodes.length} episode${episodes.length === 1 ? "" : "s"} across ${shows.length} show${
        shows.length === 1 ? "" : "s"
      }`
    : `${shows.length > 5 ? `+${shows.length - 5} · ` : ""}${episodes.length} ep`;

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1">
        {shows.slice(0, 5).map((show) => (
          <span
            key={show.id}
            title={`${show.name} · ${show.count} episode${show.count === 1 ? "" : "s"}`}
            className={`block w-7 shrink-0 overflow-hidden rounded-md ${
              show.preferred ? "ring-2 ring-berry" : ""
            }`}
          >
            <Artwork
              src={show.artwork}
              title={show.name}
              seed={show.slug}
              accent={show.accent}
              shape="cover"
              className="w-7 text-[9px]"
            />
          </span>
        ))}
      </div>
      <span className="text-[11px] font-semibold text-muted-foreground">{summary}</span>
    </div>
  );
}
