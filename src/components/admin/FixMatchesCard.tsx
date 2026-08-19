import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, Unlink } from "lucide-react";
import { listEpisodeLinks, relinkEpisodeMovie, searchMoviesByTitle } from "@/lib/ingestion.functions";

type LinkRow = {
  episodeId: string;
  movieId: string;
  episodeTitle: string;
  podcastName: string;
  movieTitle: string;
  movieYear: number | null;
  method: string;
  confidence: number;
};

const BANDS = [
  { label: "Weak first (≤ 0.80)", value: 0.8 },
  { label: "Unreviewed (≤ 0.95)", value: 0.95 },
  { label: "All links", value: 1 },
] as const;

/**
 * Fixes links that already exist: search by episode, show or movie title, then
 * unlink the wrong movie or point the episode at the right one.
 */
export function FixMatchesCard({ onSuccess }: { onSuccess: () => void }) {
  const listFn = useServerFn(listEpisodeLinks);
  const relinkFn = useServerFn(relinkEpisodeMovie);
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [maxConfidence, setMaxConfidence] = useState<number>(0.95);

  const links = useQuery({
    queryKey: ["episode-links", submitted, maxConfidence],
    queryFn: () =>
      listFn({ data: { search: submitted || undefined, maxConfidence, limit: 50 } }),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const relink = useMutation({
    mutationFn: (vars: { episodeId: string; fromMovieId: string; toMovieId?: string }) =>
      relinkFn({ data: vars }),
    onSuccess: () => {
      links.refetch();
      onSuccess();
    },
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold">Fix wrong matches</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Review links that already exist. Unlink a wrong movie, or relink the episode to the
        right one — rejected pairs are never suggested again.
      </p>

      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(search.trim());
        }}
      >
        <label className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Episode, show or movie title"
            aria-label="Search links"
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </label>
        <select
          value={maxConfidence}
          onChange={(e) => setMaxConfidence(Number(e.target.value))}
          aria-label="Confidence band"
          className="rounded-full border border-border bg-background px-3 py-2 text-sm"
        >
          {BANDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground neon"
        >
          Search
        </button>
      </form>

      {links.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading links…</p>
      ) : links.isError ? (
        <p className="mt-4 text-sm text-destructive">{(links.error as Error).message}</p>
      ) : (links.data?.links.length ?? 0) === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No links match that filter.</p>
      ) : (
        <>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Showing {links.data?.links.length} of {links.data?.total} links
          </p>
          <ul className="mt-2 space-y-2">
            {(links.data?.links ?? []).map((row: LinkRow) => (
              <li
                key={`${row.episodeId}:${row.movieId}`}
                className="rounded-xl border border-border bg-background p-3"
              >
                <p className="text-sm font-semibold leading-snug">{row.episodeTitle}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{row.podcastName}</p>
                <p className="mt-2 text-xs">
                  Linked to{" "}
                  <span className="font-semibold text-foreground">
                    {row.movieTitle}
                    {row.movieYear ? ` (${row.movieYear})` : ""}
                  </span>{" "}
                  · {row.method} · {Math.round(row.confidence * 100)}%
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      relink.mutate({ episodeId: row.episodeId, fromMovieId: row.movieId })
                    }
                    disabled={relink.isPending}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                  >
                    <Unlink className="size-3.5" aria-hidden />
                    Unlink
                  </button>
                  <RelinkPicker
                    disabled={relink.isPending}
                    onPick={(movieId) =>
                      relink.mutate({
                        episodeId: row.episodeId,
                        fromMovieId: row.movieId,
                        toMovieId: movieId,
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {relink.isError ? (
        <p className="mt-3 text-xs text-destructive">{(relink.error as Error).message}</p>
      ) : null}
    </section>
  );
}

function RelinkPicker({
  onPick,
  disabled,
}: {
  onPick: (movieId: string) => void;
  disabled?: boolean;
}) {
  const searchFn = useServerFn(searchMoviesByTitle);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");

  const results = useQuery({
    queryKey: ["movie-search", submitted],
    queryFn: () => searchFn({ data: { term: submitted } }),
    enabled: submitted.length > 1,
    retry: false,
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
      >
        Relink to another movie
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card p-2">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(term.trim());
        }}
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search catalogue movies"
          aria-label="Search movies to relink"
          className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs"
        />
        <button
          type="submit"
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
        >
          Find
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
        >
          Cancel
        </button>
      </form>

      {results.isLoading && submitted ? (
        <p className="mt-2 text-xs text-muted-foreground">Searching…</p>
      ) : null}
      {results.data ? (
        results.data.movies.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No catalogue movie matches. Add it from TMDB on the Movies tab first.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {results.data.movies.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(m.id);
                    setOpen(false);
                  }}
                  className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold hover:bg-secondary"
                >
                  {m.title}
                  {m.release_year ? ` (${m.release_year})` : ""}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
