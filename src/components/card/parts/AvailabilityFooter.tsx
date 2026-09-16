import { ExternalLink } from "lucide-react";
import { BrandBadge } from "@/components/BrandBadge";
import { PlatformBadges } from "@/components/PlatformBadges";
import type { StreamingService } from "@/lib/types";

/**
 * Where you can watch a movie: streaming-service badges then genres.
 * `showLabel` keeps the browse cards' named badges and the denser
 * relationship/compact cards' icon-only ones on one implementation.
 */
export function StreamingFooter({
  services,
  genres,
  limit,
  active = true,
  showLabel = true,
  emptyText = "No streaming availability",
}: {
  services: StreamingService[];
  genres?: { name: string }[] | undefined;
  limit?: number | undefined;
  active?: boolean | undefined;
  showLabel?: boolean | undefined;
  emptyText?: string | undefined;
}) {
  const list = limit ? services.slice(0, limit) : services;
  return (
    <>
      {list.length > 0 ? (
        list.map((s) => (
          <BrandBadge
            key={s.id}
            slug={s.slug}
            label={s.short_name}
            active={active}
            showLabel={showLabel}
          />
        ))
      ) : (
        <span className="text-[11px] text-muted-foreground">{emptyText}</span>
      )}
      {genres ? (
        <span className="text-[11px] text-muted-foreground">
          {genres.map((g) => g.name).join(" · ") || "Uncategorised"}
        </span>
      ) : null}
    </>
  );
}

/** Primary "Listen" action plus the supporting platform destinations. */
export function ListenFooter({
  listenUrl,
  sources,
  emphasis = "primary",
}: {
  listenUrl: string | null;
  sources: { platform: string; url: string }[];
  emphasis?: "primary" | "secondary";
}) {
  return (
    <>
      {listenUrl ? (
        <a
          href={listenUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={
            emphasis === "primary"
              ? "inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              : "inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground"
          }
        >
          Listen
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}
      <PlatformBadges sources={sources} exclude={listenUrl} />
    </>
  );
}
