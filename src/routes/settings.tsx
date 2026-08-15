import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Heart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { accentFor, accentSoft, toAccent } from "@/lib/accents";
import { useDiscovery } from "@/lib/discovery";
import { prefsActions } from "@/lib/prefs";
import { scorePodcast } from "@/lib/scoring";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Your setup — Movie Afterparty" },
      {
        name: "description",
        content:
          "Pick the streaming services you pay for and the commentary podcasts you actually want to hear.",
      },
      { property: "og:title", content: "Your setup — Movie Afterparty" },
      {
        property: "og:description",
        content: "Streaming services and preferred podcasts drive every recommendation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { catalog, prefs, user, isLoading } = useDiscovery();

  const podcasts = (catalog?.podcasts ?? [])
    .map((podcast) => ({
      podcast,
      preferred: prefs.preferredPodcastSlugs.includes(podcast.slug),
      rank: catalog ? scorePodcast(podcast, catalog, user) : { score: 0, movieCount: 0, reason: "" },
    }))
    .sort(
      (a, b) =>
        Number(b.preferred) - Number(a.preferred) ||
        b.rank.score - a.rank.score ||
        a.podcast.name.localeCompare(b.podcast.name),
    );

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-3xl px-5 pb-16 pt-8">
        <h1 className="font-display text-3xl">Your setup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Everything here is yours to change — recommendations update immediately.
        </p>

        <section className="mt-6">
          <h2 className="font-display text-xl">Streaming services</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(catalog?.services ?? []).map((service) => {
              const on = prefs.serviceSlugs.includes(service.slug);
              return (
                <button
                  key={service.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => prefsActions.toggleService(service.slug, !on)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
                    on
                      ? "border-transparent bg-navy text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {on ? <Check className="size-3.5" aria-hidden /> : null}
                  {service.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl">Podcasts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preferred podcasts push the movies they cover up your Tonight list.
          </p>
          {isLoading ? (
            <ul className="mt-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="h-16 animate-pulse rounded-2xl bg-muted" />
              ))}
            </ul>
          ) : (
            <ul className="mt-4 space-y-2">
              {podcasts.map(({ podcast, preferred, rank }) => {
                const accent = toAccent(podcast.accent ?? accentFor(podcast.slug));
                return (
                  <li
                    key={podcast.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{podcast.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {rank.movieCount} movie{rank.movieCount === 1 ? "" : "s"} here ·{" "}
                        {podcast.episode_count} episodes · {rank.reason}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-pressed={preferred}
                      aria-label={preferred ? `Unfollow ${podcast.name}` : `Prefer ${podcast.name}`}
                      onClick={() => prefsActions.togglePreferredPodcast(podcast.slug, !preferred)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                        preferred
                          ? "bg-berry text-primary-foreground"
                          : `${accentSoft(accent)} opacity-80`
                      }`}
                    >
                      <Heart className="size-3.5" aria-hidden />
                      {preferred ? "Preferred" : "Prefer"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </AppShell>
  );
}
