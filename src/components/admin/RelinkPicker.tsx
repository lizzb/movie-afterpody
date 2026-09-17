import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { enrichMovie, searchMoviesByTitle } from "@/lib/ingestion.functions";

const IMDB_RE = /^tt\d{6,10}$/i;

/**
 * Catalogue search that also accepts an IMDb id, pulling the movie in via TMDB.
 * One picker for every surface: Match review relinks, Unmatched episodes and
 * (Pass U64) the "Add movie" action on a link-less episode card.
 */
export function RelinkPicker({
  onPick,
  disabled,
  label = "Pick another movie",
}: {
  onPick: (movieId: string) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
}) {
  const searchFn = useServerFn(searchMoviesByTitle);
  const enrichFn = useServerFn(enrichMovie);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [year, setYear] = useState("");
  const [submittedYear, setSubmittedYear] = useState<number | undefined>(undefined);
  const [imdbBusy, setImdbBusy] = useState(false);
  const [imdbError, setImdbError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ["movie-search", submitted, submittedYear],
    queryFn: () => searchFn({ data: { term: submitted, year: submittedYear } }),
    enabled: submitted.length > 1 && !IMDB_RE.test(submitted),
    retry: false,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = term.trim();
    const parsedYear = year.trim() ? Number(year.trim()) : undefined;
    setImdbError(null);
    if (!IMDB_RE.test(value)) {
      if (parsedYear !== undefined && (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2030)) {
        setImdbError("Enter a four-digit release year, or leave it blank.");
        return;
      }
      setSubmitted(value);
      setSubmittedYear(parsedYear);
      return;
    }
    setImdbBusy(true);
    try {
      const created = (await enrichFn({ data: { imdbId: value } })) as {
        movie?: { id: string };
        movieId?: string;
      };
      const id = created.movie?.id ?? created.movieId;
      if (!id) throw new Error("TMDB had no movie for that IMDb id.");
      await onPick(id);
      setOpen(false);
    } catch (err) {
      setImdbError(err instanceof Error ? err.message : "IMDb lookup failed.");
    } finally {
      setImdbBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card p-2">
      <form className="flex flex-wrap gap-2" onSubmit={submit}>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Movie title or IMDb id (tt0110989)"
          aria-label="Search movies or paste an IMDb id"
          className="min-w-48 flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs"
        />
        <input
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Year"
          inputMode="numeric"
          aria-label="Release year"
          className="w-20 rounded-full border border-border bg-background px-3 py-1.5 text-xs"
        />
        <button
          type="submit"
          disabled={imdbBusy}
          className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {imdbBusy ? "Fetching…" : "Find"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
        >
          Cancel
        </button>
      </form>

      {imdbError ? <p className="mt-2 text-xs text-destructive">{imdbError}</p> : null}
      {results.isLoading && submitted ? (
        <p className="mt-2 text-xs text-muted-foreground">Searching…</p>
      ) : null}
      {results.data ? (
        results.data.movies.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No catalogue movie matches. Paste its IMDb id (tt…) to pull it in from TMDB.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {results.data.movies.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    void onPick(m.id);
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
