const LABELS: Record<string, string> = {
  spotify: "Spotify",
  apple: "Apple Podcasts",
  apple_podcasts: "Apple Podcasts",
  itunes: "Apple Podcasts",
  podcastindex: "Podcast Index",
  rss: "RSS",
  youtube: "YouTube",
  patreon: "Patreon",
  web: "Website",
};

export const prettyPlatform = (platform: string) =>
  LABELS[platform.toLowerCase()] ??
  platform.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Where you can listen to one episode — small outline pills in a card footer. */
export function PlatformBadges({
  sources,
  exclude,
}: {
  sources: { platform: string; url: string }[];
  /** Skip the destination already shown by the Listen button. */
  exclude?: string | null;
}) {
  const list = sources.filter((s) => s.url && s.url !== exclude);
  if (list.length === 0) return null;

  return (
    <>
      {list.map((s) => (
        <a
          key={`${s.platform}-${s.url}`}
          href={s.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          {prettyPlatform(s.platform)}
        </a>
      ))}
    </>
  );
}
