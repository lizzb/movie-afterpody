import { Ban, Loader2, Undo2 } from "lucide-react";
import { EpisodeReviewButton } from "@/components/EpisodeReviewButton";
import { useMarkEpisodeNotAboutMovie, useUndoEpisodeRetirement } from "@/lib/episode-reviews";

interface Props {
  episodeId: string;
  reviewed: boolean;
  /** True once the episode is marked "not about a movie". */
  retired?: boolean;
  variant?: "inline" | "block";
  /**
   * Pass U38 — episode-level sign-off only belongs in episode-centric contexts.
   * A relationship-only card (one movie's episode) sets this to false.
   */
  includeReview?: boolean;
  /**
   * Pass U53 — movie ids linked on this card. Only pass them where the card shows
   * the episode's whole link set; sign-off then confirms those links too.
   */
  linkedMovieIds?: string[];

}

/**
 * Right-aligned admin-only controls for a consumer episode row:
 * "Not about a movie" (retire) then "Mark episode reviewed".
 * The retire control is a toggle — pressing it again undoes the decision and
 * restores the links that retirement removed.
 * A reviewed episode is settled, so only "Reopen" is offered.
 * Render only when the viewer is an admin.
 */
export function EpisodeAdminActions({
  episodeId,
  reviewed,
  retired = false,
  variant = "inline",
  includeReview = true,
  linkedMovieIds,
}: Props) {

  const retire = useMarkEpisodeNotAboutMovie();
  const undo = useUndoEpisodeRetirement();
  const isRetired = (retired || retire.isSuccess) && !undo.isSuccess;
  const pending = retire.isPending || undo.isPending;

  return (
    <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">

      {reviewed ? null : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (pending) return;
            if (isRetired) undo.mutate({ episodeId });
            else retire.mutate({ episodeId });
          }}
          disabled={pending}
          aria-pressed={isRetired}
          title={
            isRetired
              ? "Marked as not about a movie — press again to undo and restore its movie links"
              : "Not about a movie — retires this episode from every review queue"
          }
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-100 ${
            isRetired || pending
              ? "border-transparent bg-gold text-primary-foreground"
              : "border-border text-gold hover:bg-gold hover:text-primary-foreground"
          } ${variant === "block" ? "px-3.5 py-2 text-xs" : ""}`}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : isRetired ? (
            <Undo2 className="size-4" aria-hidden />
          ) : (
            <Ban className="size-4" aria-hidden />
          )}
          {isRetired ? "Undo not about a movie" : "Not about a movie"}
        </button>
      )}
      {includeReview ? (
        <EpisodeReviewButton
          episodeId={episodeId}
          reviewed={reviewed}
          variant={variant}
          {...(linkedMovieIds ? { linkedMovieIds } : {})}
        />

      ) : null}
    </div>
  );
}
