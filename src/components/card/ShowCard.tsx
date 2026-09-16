import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { Artwork } from "@/components/Artwork";
import { BrandBadge } from "@/components/BrandBadge";
import { CardBadges, CardFooter, CardHeader } from "@/components/card/Card";
import { MediaCardFrame } from "@/components/card/MediaCardFrame";
import { PreferShowButton } from "@/components/card/parts/StatusActions";
import type { PodcastSummary } from "@/lib/podcast-entries";
import type { ViewMode } from "@/lib/prefs";

/**
 * Pass K11 — the one podcast-show card. Shows browse is its consumer today; the
 * compact variant exists for any denser show context (search results, pickers).
 */
export type ShowCardVariant = "browse" | "compact";

export interface ShowCardProps {
  entry: PodcastSummary;
  /** Live follow state, so the heart responds on the first tap. */
  preferred: boolean;
  variant?: ShowCardVariant | undefined;
  density?: ViewMode | undefined;
  /** Podcast genres, when a genre source exists. Reserved optional slot. */
  genres?: { name: string }[] | undefined;
  /** Optional two-line description preview — off by default (K11). */
  showDescription?: boolean | undefined;
}

export function ShowCard({
  entry,
  preferred,
  variant = "browse",
  density = "rows",
  genres,
  showDescription = false,
}: ShowCardProps) {
  const { podcast, matchScore, streamableCount, movieCount, metric, episodeCount, links } = entry;

  if (density === "tiles") {
    return (
      <li>
        <Link to="/podcasts/$slug" params={{ slug: podcast.slug }} className="block">
          <Artwork
            src={podcast.artwork_url}
            title={podcast.name}
            seed={podcast.slug}
            accent={podcast.accent}
            shape="cover"
            className="w-full text-3xl shadow-poster"
          />
          <h2 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{podcast.name}</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Match {matchScore} · {streamableCount} tonight
          </p>
        </Link>
      </li>
    );
  }

  return (
    <MediaCardFrame
      className="p-3"
      linkTo={{ to: "/podcasts/$slug", params: { slug: podcast.slug } }}
      controls={
        <PreferShowButton
          slug={podcast.slug}
          name={podcast.name}
          preferred={preferred}
          size="md"
        />
      }
      media={
        <Artwork
          src={podcast.artwork_url}
          title={podcast.name}
          seed={podcast.slug}
          accent={podcast.accent}
          shape="cover"
          className={variant === "browse" ? "w-14 text-lg" : "w-12 text-base"}
        />
      }
      header={<CardHeader reserveRight={1} title={podcast.name} />}
      badges={
        <CardBadges>
          <span className="rounded-full bg-coral-soft px-2 py-1 text-coral">
            Match {matchScore}
          </span>
          <span className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
            {streamableCount} tonight
          </span>
          <span className="rounded-full bg-secondary px-2 py-1 text-secondary-foreground">
            {movieCount} movie{movieCount === 1 ? "" : "s"} · {episodeCount} ep
          </span>
          {metric?.rating != null ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold-soft px-2 py-1 text-gold">
              <Star className="size-3" aria-hidden />
              {metric.rating.toFixed(1)}
            </span>
          ) : null}
        </CardBadges>
      }
      body={
        showDescription && podcast.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{podcast.description}</p>
        ) : undefined
      }
      footer={
        links.length > 0 || genres ? (
          <CardFooter>
            {links.map((l) => (
              <BrandBadge
                key={`${l.podcast_id}-${l.platform}`}
                slug={l.platform}
                label={l.platform}
                showLabel={false}
              />
            ))}
            {genres ? (
              <span className="text-[11px] text-muted-foreground">
                {genres.map((g) => g.name).join(" · ")}
              </span>
            ) : null}
          </CardFooter>
        ) : undefined
      }
    />
  );
}
