import { Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { enrichMovie, ingestPodcast } from "@/lib/ingestion.functions";

/**
 * Shown when a search finds nothing: lets an admin pull the missing title
 * straight from TMDB (movies) or Podcast Index (shows).
 */
export function CatalogAddCard({ kind, term }: { kind: "movie" | "podcast"; term: string }) {
  const { userId } = useAuth();
  const client = useQueryClient();
  const addMovie = useServerFn(enrichMovie);
  const addPodcast = useServerFn(ingestPodcast);

  const mutation = useMutation({
    mutationFn: async () =>
      kind === "movie"
        ? await addMovie({ data: { title: term } })
        : await addPodcast({ data: { query: term, maxEpisodes: 300 } }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["catalog"] }),
  });

  const source = kind === "movie" ? "TMDB" : "Podcast Index";
  const label = kind === "movie" ? "movie" : "podcast";

  return (
    <section className="mt-5 rounded-2xl border border-dashed border-border bg-card p-5 text-center">
      <h2 className="font-display text-lg font-bold">
        Nothing here for &ldquo;{term}&rdquo;
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Look it up on {source} and add it to the catalogue.
      </p>

      {!userId ? (
        <Link
          to="/auth"
          className="mt-4 inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
        >
          Sign in to add data
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground neon disabled:opacity-60"
        >
          <Plus className="size-4" aria-hidden />
          {mutation.isPending ? `Searching ${source}…` : `Add this ${label} from ${source}`}
        </button>
      )}

      {mutation.isSuccess ? (
        <p className="mt-3 text-xs font-semibold text-teal">
          Added. Pull to refresh if it does not appear yet.
        </p>
      ) : null}
      {mutation.isError ? (
        <p className="mt-3 text-xs text-destructive">{(mutation.error as Error).message}</p>
      ) : null}
    </section>
  );
}
