import { RelinkPicker } from "@/components/admin/RelinkPicker";
import { useAddEpisodeMovieLink } from "@/lib/episode-reviews";

/**
 * Pass U64 — "Add movie" on a link-less episode card. Same picker as Match
 * review and Unmatched episodes (catalogue search plus IMDb id), same manual
 * link path; only the button label differs.
 */
export function EpisodeAddMovieControl({ episodeId }: { episodeId: string }) {
  const add = useAddEpisodeMovieLink();
  return (
    <RelinkPicker
      label="Add movie"
      disabled={add.isPending}
      onPick={async (movieId) => {
        await add.mutateAsync({ episodeId, movieId });
      }}
    />
  );
}
