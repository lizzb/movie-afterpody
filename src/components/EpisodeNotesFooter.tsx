import { ExternalLink } from "lucide-react";
import { CardExpand } from "@/components/card/Card";
import { prefsActions } from "@/lib/prefs";
import type { EpisodeRating, ListeningStatus, ProductionQuality } from "@/lib/types";

const RATINGS: { value: EpisodeRating; emoji: string; label: string }[] = [
  { value: "disliked", emoji: "😞", label: "Didn't like it" },
  { value: "meh", emoji: "😐", label: "It was fine" },
  { value: "loved", emoji: "😊", label: "Loved it" },
];

const LISTENING: { value: ListeningStatus; label: string }[] = [
  { value: "not_started", label: "Not started" },
  { value: "started", label: "Started" },
  { value: "finished", label: "Finished" },
];

const QUALITY: { value: ProductionQuality; label: string }[] = [
  { value: "poor", label: "Rough audio" },
  { value: "okay", label: "Okay audio" },
  { value: "good", label: "Great audio" },
];

/**
 * The expand-collapse rating footer shared by both episode cards (K5/K6), so
 * rating an episode works the same on a movie page and on a show page.
 */
export function EpisodeNotesFooter({
  episodeSlug,
  rating,
  listening,
  quality,
  listenUrl,
}: {
  episodeSlug: string;
  rating: EpisodeRating | null;
  listening: ListeningStatus;
  quality: ProductionQuality | null;
  listenUrl?: string | null;
}) {
  const hasNotes = Boolean(rating) || listening !== "not_started" || Boolean(quality);

  return (
    <CardExpand label={hasNotes ? "Your notes" : "Rate this episode"}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="group" aria-label="Rate this episode">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              title={r.label}
              aria-label={r.label}
              aria-pressed={rating === r.value}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                prefsActions.rateEpisode(episodeSlug, rating === r.value ? null : r.value);
              }}
              className={`rounded-full border px-2.5 py-1 text-base transition-all ${
                rating === r.value
                  ? "scale-105 border-transparent bg-secondary"
                  : "border-border opacity-60 hover:opacity-100"
              }`}
            >
              {r.emoji}
            </button>
          ))}
        </div>

        <select
          value={listening}
          onChange={(e) => prefsActions.setListening(episodeSlug, e.target.value as ListeningStatus)}
          aria-label="Listening status"
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
        >
          {LISTENING.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <select
          value={quality ?? ""}
          onChange={(e) =>
            prefsActions.setQuality(
              episodeSlug,
              e.target.value === "" ? null : (e.target.value as ProductionQuality),
            )
          }
          aria-label="Production quality"
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
        >
          <option value="">Audio quality</option>
          {QUALITY.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
            </option>
          ))}
        </select>

        {listenUrl ? (
          <a
            href={listenUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Listen
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </div>
    </CardExpand>
  );
}
