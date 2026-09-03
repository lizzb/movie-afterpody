import { Ban, Loader2 } from "lucide-react";
import { EpisodeReviewButton } from "@/components/EpisodeReviewButton";
import { useMarkEpisodeNotAboutMovie } from "@/lib/episode-reviews";

interface Props {
  episodeId: string;
  reviewed: boolean;
  variant?: "inline" | "block";
}

/**
 * Right-aligned admin-only controls for a consumer episode row:
 * "Not about a movie" (retire) then "Mark episode reviewed".
 * Render only when the viewer is an admin.
 */
export function EpisodeAdminActions({ episodeId, reviewed, variant = "inline" }: Props) {
  const retire = useMarkEpisodeNotAboutMovie();

  return (
    <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          retire.mutate({ episodeId });
        }}
        disabled={retire.isPending}
        title="Not about a movie — retires this episode from every review queue"
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] font-semibold text-gold transition-colors hover:bg-gold hover:text-primary-foreground disabled:opacity-50 ${
          variant === "block" ? "px-3.5 py-2 text-xs" : ""
        }`}
      >
        {retire.isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Ban className="size-4" aria-hidden />
        )}
        Not about a movie
      </button>
      <EpisodeReviewButton episodeId={episodeId} reviewed={reviewed} variant={variant} />
    </div>
  );
}
