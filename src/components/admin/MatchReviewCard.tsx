import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Ban, Check, Search, Unlink, X } from "lucide-react";
import {
  approveEpisodeMatch,
  bulkMatchDecision,
  confirmEpisodeMatch,
  enrichMovie,
  listEpisodeLinks,
  markEpisodeNotAboutMovie,
  rejectEpisodeMatch,
  relinkEpisodeMovie,
  searchMoviesByTitle,
  suggestEpisodeMatches,
} from "@/lib/ingestion.functions";

type Tab = "proposed" | "existing";

const BANDS = [
  { label: "Weakest first (≤ 80%)", value: 0.8 },
  { label: "Unreviewed (≤ 95%)", value: 0.95 },
  { label: "All links", value: 1 },
] as const;

/** Plain-language names for the match_method values stored on each link. */
export function methodLabel(method: string): string {
  switch (method) {
    case "deterministic":
      return "Strong title match";
    case "heuristic":
      return "Weak title match";
    case "manual":
      return "Confirmed by you";
    case "ai":
      return "AI match";
    default:
      return "Legacy seed";
  }
}

const IMDB_RE = /^tt\d{6,10}$/i;

/**
 * One place for the whole review job: proposals the matcher computed, and links
 * that already exist. Same search, same confidence band, same selection model.
 */
export function MatchReviewCard({ onSuccess }: { onSuccess: () => void }) {
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>("proposed");
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [maxConfidence, setMaxConfidence] = useState<number>(0.8);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const suggestFn = useServerFn(suggestEpisodeMatches);
  const linksFn = useServerFn(listEpisodeLinks);
  const approveFn = useServerFn(approveEpisodeMatch);
  const rejectFn = useServerFn(rejectEpisodeMatch);
  const confirmFn = useServerFn(confirmEpisodeMatch);
  const relinkFn = useServerFn(relinkEpisodeMovie);
  const bulkFn = useServerFn(bulkMatchDecision);
  const retireFn = useServerFn(markEpisodeNotAboutMovie);

  const proposals = useQuery({
    queryKey: ["match-suggestions", submitted, Math.round(maxConfidence * 100)],
    queryFn: () =>
      suggestFn({
        data: {
          search: submitted || undefined,
          maxConfidence: Math.round(maxConfidence * 100),
          limit: 40,
        },
      }),
    enabled: tab === "proposed",
    retry: false,
    refetchOnWindowFocus: false,
  });

  const links = useQuery({
    queryKey: ["episode-links", submitted, maxConfidence],
    queryFn: () => linksFn({ data: { search: submitted || undefined, maxConfidence, limit: 50 } }),
    enabled: tab === "existing",
    retry: false,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => {
    if (tab === "proposed") {
      return (proposals.data?.suggestions ?? []).map((s) => ({
        key: s.episodeId,
        episodeId: s.episodeId,
        movieId: s.topCandidate!.movieId,
        episodeTitle: s.episodeTitle,
        podcastName: s.podcastName,
        movieTitle: s.topCandidate!.title,
        movieYear: s.topCandidate!.releaseYear,
        detail: `${s.topCandidate!.confidence}% — ${s.topCandidate!.reason}`,
        rejectedBefore: s.topCandidate!.rejectedBefore,
      }));
    }
    return (links.data?.links ?? []).map((l) => ({
      key: `${l.episodeId}:${l.movieId}`,
      episodeId: l.episodeId,
      movieId: l.movieId,
      episodeTitle: l.episodeTitle,
      podcastName: l.podcastName,
      movieTitle: l.movieTitle,
      movieYear: l.movieYear,
      detail: `${methodLabel(l.method)} · ${Math.round(l.confidence * 100)}%`,
      rejectedBefore: 0,
    }));
  }, [tab, proposals.data, links.data]);

  const total = tab === "proposed" ? (proposals.data?.total ?? 0) : (links.data?.total ?? 0);
  const loading = tab === "proposed" ? proposals.isLoading : links.isLoading;
  const queryError = tab === "proposed" ? proposals.error : links.error;

  const refresh = async () => {
    setSelected({});
    await client.invalidateQueries({ queryKey: ["match-suggestions"] });
    await client.invalidateQueries({ queryKey: ["episode-links"] });
    await client.invalidateQueries({ queryKey: ["unmatched-episodes"] });
    await client.invalidateQueries({ queryKey: ["match-actions"] });
    onSuccess();
  };

  const single = useMutation({
    mutationFn: async (vars: {
      action: "approve" | "reject" | "confirm" | "unlink" | "retire";
      episodeId: string;
      movieId: string;
    }) => {
      if (vars.action === "approve") return approveFn({ data: { episodeId: vars.episodeId, movieId: vars.movieId } });
      if (vars.action === "reject") return rejectFn({ data: { episodeId: vars.episodeId, movieId: vars.movieId } });
      if (vars.action === "confirm") return confirmFn({ data: { episodeId: vars.episodeId, movieId: vars.movieId } });
      if (vars.action === "retire") return retireFn({ data: { episodeId: vars.episodeId } });
      return relinkFn({ data: { episodeId: vars.episodeId, fromMovieId: vars.movieId } });
    },
    onSuccess: () => {
      setError(null);
      void refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const bulk = useMutation({
    mutationFn: (action: "approve" | "reject" | "confirm" | "unlink") =>
      bulkFn({
        data: {
          action,
          pairs: Object.entries(selected).map(([episodeId, movieId]) => ({ episodeId, movieId })),
        },
      }),
    onSuccess: (result) => {
      setError(null);
      setNote(
        `${result.succeeded} of ${result.attempted} applied${result.failed.length ? ` · ${result.failed.length} failed` : ""}.`,
      );
      void refresh();
    },
    onError: (e: Error) => setError(e.message),
  });

  const selectedCount = Object.keys(selected).length;
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected[r.episodeId] === r.movieId);

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected({});
      return;
    }
    const next: Record<string, string> = {};
    for (const r of rows) next[r.episodeId] = r.movieId;
    setSelected(next);
  };

  const runBulk = (action: "approve" | "reject" | "confirm" | "unlink") => {
    const destructive = action === "reject" || action === "unlink";
    if (
      destructive &&
      !window.confirm(`${action === "reject" ? "Reject" : "Unlink"} ${selectedCount} selected match(es)?`)
    ) {
      return;
    }
    bulk.mutate(action);
  };

  return (
    <section id="match-review" className="scroll-mt-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl font-bold">Match review</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        One queue, two states. <strong>Proposed</strong> are links the matcher suggests but has not
        written. <strong>Existing links</strong> are already saved — confirm them, unlink them, or
        point the episode at a different movie. Rejected pairs are never suggested again.
      </p>

      <div className="mt-4 inline-flex rounded-full border border-border p-1">
        {(
          [
            ["proposed", "Proposed"],
            ["existing", "Existing links"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setSelected({});
              setNote(null);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(search.trim());
          setSelected({});
        }}
      >
        <label className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Episode, show or movie title"
            aria-label="Search matches"
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

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {note ? <p className="mt-3 text-sm text-teal">{note}</p> : null}

      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-2xl bg-muted" />
      ) : queryError ? (
        <p className="mt-4 text-sm text-destructive">{(queryError as Error).message}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {tab === "proposed" ? "No proposals in this band." : "No saved links match that filter."}
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Showing {rows.length} of {total} {tab === "proposed" ? "proposals" : "links"}
            </p>
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
            >
              {allVisibleSelected ? "Clear selection" : "Select all shown"}
            </button>
          </div>

          {selectedCount > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-3">
              <span className="text-xs font-semibold">{selectedCount} selected</span>
              {tab === "proposed" ? (
                <>
                  <button
                    type="button"
                    disabled={bulk.isPending}
                    onClick={() => runBulk("approve")}
                    className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Approve all
                  </button>
                  <button
                    type="button"
                    disabled={bulk.isPending}
                    onClick={() => runBulk("reject")}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    Reject all
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={bulk.isPending}
                    onClick={() => runBulk("confirm")}
                    className="rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Confirm all correct
                  </button>
                  <button
                    type="button"
                    disabled={bulk.isPending}
                    onClick={() => runBulk("unlink")}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    Unlink all
                  </button>
                </>
              )}
              {bulk.isPending ? <span className="text-xs text-muted-foreground">Applying…</span> : null}
            </div>
          ) : null}

          <ul className="mt-3 space-y-2">
            {rows.map((row) => (
              <li key={row.key} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.episodeTitle}`}
                    checked={selected[row.episodeId] === row.movieId}
                    onChange={(e) =>
                      setSelected((prev) => {
                        const next = { ...prev };
                        if (e.target.checked) next[row.episodeId] = row.movieId;
                        else delete next[row.episodeId];
                        return next;
                      })
                    }
                    className="mt-1 size-4 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{row.episodeTitle}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{row.podcastName}</p>
                    <p className="mt-2 text-xs">
                      {tab === "proposed" ? "Suggested: " : "Linked to "}
                      <span className="font-semibold text-foreground">
                        {row.movieTitle}
                        {row.movieYear ? ` (${row.movieYear})` : ""}
                      </span>{" "}
                      · {row.detail}
                    </p>
                    {row.rejectedBefore >= 2 ? (
                      <p className="mt-1 text-xs text-coral">
                        This movie has been rejected {row.rejectedBefore}× elsewhere.
                      </p>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {tab === "proposed" ? (
                        <>
                          <button
                            type="button"
                            disabled={single.isPending}
                            onClick={() =>
                              single.mutate({ action: "approve", episodeId: row.episodeId, movieId: row.movieId })
                            }
                            className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            <Check className="size-3.5" aria-hidden />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={single.isPending}
                            onClick={() =>
                              single.mutate({ action: "reject", episodeId: row.episodeId, movieId: row.movieId })
                            }
                            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                          >
                            <X className="size-3.5" aria-hidden />
                            Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={single.isPending}
                            onClick={() =>
                              single.mutate({ action: "confirm", episodeId: row.episodeId, movieId: row.movieId })
                            }
                            className="inline-flex items-center gap-1.5 rounded-full bg-teal px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            <Check className="size-3.5" aria-hidden />
                            Correct
                          </button>
                          <button
                            type="button"
                            disabled={single.isPending}
                            onClick={() =>
                              single.mutate({ action: "unlink", episodeId: row.episodeId, movieId: row.movieId })
                            }
                            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                          >
                            <Unlink className="size-3.5" aria-hidden />
                            Unlink
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        disabled={single.isPending}
                        onClick={() =>
                          single.mutate({ action: "retire", episodeId: row.episodeId, movieId: row.movieId })
                        }
                        title="Stop suggesting matches for this episode"
                        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        <Ban className="size-3.5" aria-hidden />
                        Not about a movie
                      </button>
                      <RelinkPicker
                        disabled={single.isPending}
                        onPick={async (movieId) => {
                          try {
                            if (tab === "proposed") {
                              await approveFn({ data: { episodeId: row.episodeId, movieId } });
                            } else {
                              await relinkFn({
                                data: { episodeId: row.episodeId, fromMovieId: row.movieId, toMovieId: movieId },
                              });
                            }
                            setError(null);
                            await refresh();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Could not relink.");
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Catalogue search that also accepts an IMDb id, pulling the movie in via TMDB. */
function RelinkPicker({
  onPick,
  disabled,
}: {
  onPick: (movieId: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const searchFn = useServerFn(searchMoviesByTitle);
  const enrichFn = useServerFn(enrichMovie);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [imdbBusy, setImdbBusy] = useState(false);
  const [imdbError, setImdbError] = useState<string | null>(null);

  const results = useQuery({
    queryKey: ["movie-search", submitted],
    queryFn: () => searchFn({ data: { term: submitted } }),
    enabled: submitted.length > 1 && !IMDB_RE.test(submitted),
    retry: false,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = term.trim();
    setImdbError(null);
    if (!IMDB_RE.test(value)) {
      setSubmitted(value);
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
        Pick another movie
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-border bg-card p-2">
      <form className="flex gap-2" onSubmit={submit}>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Movie title or IMDb id (tt0110989)"
          aria-label="Search movies or paste an IMDb id"
          className="flex-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs"
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
