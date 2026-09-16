import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mic, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHeader } from "@/components/PageHeader";
import { CatalogAddCard } from "@/components/CatalogAddCard";
import { ListErrorNotice } from "@/components/ListErrorNotice";
import { ShowCard } from "@/components/card/ShowCard";
import { ViewToggle } from "@/components/ViewToggle";
import { useShowPage } from "@/lib/server-lists";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/podcasts/")({
  head: () => ({
    meta: [
      { title: "Discover commentary podcasts — Movie Afterparty" },
      {
        name: "description",
        content:
          "Commentary podcasts ranked by how many of the movies they cover you can actually stream tonight.",
      },
      { property: "og:title", content: "Discover commentary podcasts — Movie Afterparty" },
      {
        property: "og:description",
        content: "Ranked podcast discovery based on your streaming services and taste.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PodcastsPage,
});

type Mode = "all" | "streamable" | "preferred";

const MODES: { value: Mode; label: string }[] = [
  { value: "all", label: "All shows" },
  { value: "streamable", label: "Watchable tonight" },
  { value: "preferred", label: "My shows" },
];

function PodcastsPage() {
  const prefs = usePrefs();
  const [term, setTerm] = useState("");
  const [mode, setMode] = useState<Mode>("all");
  const [limit, setLimit] = useState(50);
  const view = prefs.viewModes["podcasts"] ?? "rows";

  // Pass L2b — ranked and filtered on the server across every active show,
  // against the live taste profile so services and hearts always apply.
  const { rows: results, total, isLoading, error, refetch } = useShowPage({ term, mode, limit });

  useEffect(() => {
    setLimit(50);
  }, [term, mode]);

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <div className="mb-3">
          <PageHeader icon={Mic} eyebrow="Shows" title="Browse all podcasts" />
        </div>

        <div className="flex items-center gap-2">
          <label className="relative block flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search podcasts"
              aria-label="Search podcasts"
              className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-4 text-sm shadow-card"
            />
          </label>
          <ViewToggle surface="podcasts" value={view} />
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Filter podcasts">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                mode === m.value
                  ? "border-transparent bg-coral-soft text-coral neon"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <ListErrorNotice error={error} onRetry={refetch} />
        </div>

        {isLoading ? (
          <ul className="mt-4 space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </ul>
        ) : error ? null : results.length === 0 ? (
          term.trim() ? (
            <CatalogAddCard kind="podcast" term={term.trim()} />
          ) : (
            <p className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No shows match. Try &ldquo;All shows&rdquo;, or{" "}
              <Link to="/settings" className="font-semibold text-coral">
                add a streaming service
              </Link>
              .
            </p>
          )
        ) : (
          <>
            <ul
              className={
                view === "tiles"
                  ? "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                  : "mt-4 space-y-2.5"
              }
            >
              {results.map((entry) => (
                <ShowCard
                  key={entry.podcast.id}
                  entry={entry}
                  density={view}
                  preferred={prefs.preferredPodcastSlugs.includes(entry.podcast.slug)}
                />
              ))}
            </ul>
            {results.length < total ? (
              <button
                type="button"
                onClick={() => setLimit((n) => n + 50)}
                className="mt-4 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground"
              >
                Show 50 more{" "}
                <span className="text-muted-foreground">({total - results.length} remaining)</span>
              </button>
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
