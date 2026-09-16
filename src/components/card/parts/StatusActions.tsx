import { Check, Eye, EyeOff, Heart } from "lucide-react";
import { toast } from "sonner";
import { prefsActions } from "@/lib/prefs";
import { isUnrated, ratingLabel } from "@/lib/ratings";

/** Shared shape for every circular card control. */
const CONTROL = "grid size-8 shrink-0 place-items-center rounded-full border transition-colors";

/** Consumed state for a movie: watched / not watched. */
export function WatchedButton({
  slug,
  title,
  watched,
}: {
  slug: string;
  title: string;
  watched: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={watched}
      aria-label={watched ? "Mark as not watched" : "Mark as watched"}
      title={watched ? "Watched — tap to undo" : "Mark as watched"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        prefsActions.toggleWatched(slug, !watched);
        toast(watched ? `Marked as not watched: ${title}` : `Mark as watched: ${title}`, {
          action: { label: "Undo", onClick: () => prefsActions.toggleWatched(slug, watched) },
        });
      }}
      className={`${CONTROL} ${
        watched
          ? "border-transparent bg-teal text-primary-foreground"
          : "border-border bg-card/90 text-muted-foreground hover:text-foreground"
      }`}
    >
      {watched ? <Check className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
    </button>
  );
}

/** Pass H — "Not interested": excluded from Tonight, optionally hidden in Movies. */
export function NotInterestedButton({
  slug,
  title,
  off,
}: {
  slug: string;
  title: string;
  off: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={off}
      aria-label={off ? "Interested again" : "Not interested"}
      title={off ? "Not interested — tap to undo" : "Not interested"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        prefsActions.toggleNotInterested(slug, !off);
        toast(off ? `Back in suggestions: ${title}` : `Not interested: ${title}`, {
          action: { label: "Undo", onClick: () => prefsActions.toggleNotInterested(slug, off) },
        });
      }}
      className={`${CONTROL} ${
        off
          ? "border-transparent bg-secondary text-foreground"
          : "border-border bg-card/90 text-muted-foreground hover:text-foreground"
      }`}
    >
      <EyeOff className="size-4" aria-hidden />
    </button>
  );
}

/** "Prefer this show" — a user preference for a podcast, not a bookmark. */
export function PreferShowButton({
  slug,
  name,
  preferred,
  size = "sm",
}: {
  slug: string;
  name: string;
  preferred: boolean;
  size?: "sm" | "md";
}) {
  const label = preferred ? `Unfollow ${name}` : `Prefer ${name}`;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        prefsActions.togglePreferredPodcast(slug, !preferred);
      }}
      aria-pressed={preferred}
      aria-label={label}
      title={label}
      className={
        size === "md"
          ? `grid size-8 shrink-0 place-items-center rounded-full transition-colors ${
              preferred ? "text-berry" : "text-muted-foreground hover:text-foreground"
            }`
          : `grid size-7 shrink-0 place-items-center rounded-full border transition-colors ${
              preferred
                ? "border-transparent bg-berry text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
            }`
      }
    >
      <Heart
        className={size === "md" ? "size-5" : "size-3.5"}
        fill={size === "md" && preferred ? "currentColor" : "none"}
        aria-hidden
      />
    </button>
  );
}

/** Certification marker; unrated titles read "NR" rather than disappearing. */
export function RatingPill({ value }: { value: string | null | undefined }) {
  return (
    <span
      title={isUnrated(value) ? "No content rating on file" : `Rated ${value}`}
      className="inline-flex items-center rounded-full border border-border px-2 py-1 text-[10px] font-bold text-muted-foreground"
    >
      {ratingLabel(value)}
    </span>
  );
}
