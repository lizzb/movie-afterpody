import { toast } from "sonner";
import { RelinkPicker } from "@/components/admin/RelinkPicker";
import { useAddEpisodeMovieLink } from "@/lib/episode-reviews";

/**
 * Pass U64 — "Add movie" on a link-less episode card.
 * Pass U40E — "Add another movie" on an episode that already has links: same
 * picker, same manual link path, append-only (existing links are untouched).
 * Only the button label differs.
 */
export function EpisodeAddMovieControl({
  episodeId,
  label = "Add movie",
  linkedMovieIds,
}: {
  episodeId: string;
  label?: string;
  /** Already-linked movie ids, so a repeat pick reports instead of writing again. */
  linkedMovieIds?: string[];
}) {
  const add = useAddEpisodeMovieLink();
  return (
    <RelinkPicker
      label={label}
      disabled={add.isPending}
      onPick={async (movieId, movieTitle) => {
        if (linkedMovieIds?.includes(movieId)) {
          toast.info(
            movieTitle
              ? `“${movieTitle}” is already linked to this episode`
              : "That movie is already linked to this episode",
          );
          return;
        }
        await add.mutateAsync({ episodeId, movieId, ...(movieTitle ? { movieTitle } : {}) });
      }}
    />
  );
}
