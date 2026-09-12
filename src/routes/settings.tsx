import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Heart, Settings as SettingsIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Artwork } from "@/components/Artwork";
import { BrandBadge } from "@/components/BrandBadge";
import { PageHeader } from "@/components/PageHeader";
import { PartialDataNotice } from "@/components/PartialDataNotice";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";

import { useDiscovery } from "@/lib/discovery";
import { prefsActions } from "@/lib/prefs";
import { scorePodcast } from "@/lib/scoring";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Movie Afterparty" },
      {
        name: "description",
        content:
          "Pick the streaming services you pay for and the commentary podcasts you actually want to hear.",
      },
      { property: "og:title", content: "Settings — Movie Afterparty" },
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
  const { catalog, prefs, user, isLoading, partial } = useDiscovery();
  const { userId: authUserId, user: authUser } = useAuth();

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
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">
        <PageHeader
          icon={SettingsIcon}
          eyebrow="Setup"
          title="Settings"
          actions={<ThemeToggle className="shrink-0" />}
        />
        <PartialDataNotice show={partial} />

        <section className="mt-5 rounded-2xl border border-border bg-card p-4 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            App settings
          </h2>
          <SettingToggle
            label="Lock the layout"
            hint="Prevents sideways drag and pinch zoom, so the page only scrolls up and down. Turn off to allow pinch zoom."
            on={prefs.viewportLock}
            onChange={(on) => prefsActions.setViewportLock(on)}
          />
          <SettingToggle
            label="Dim watched items"
            hint="Fades movies you have already marked as watched."
            on={prefs.dimWatched}
            onChange={(on) => prefsActions.setDimWatched(on)}
          />
        </section>

        <section className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Account
            </p>
            <p className="mt-1 truncate text-sm font-semibold">
              {authUserId ? (authUser?.email ?? "Signed in") : "Not signed in"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sign-in is only needed for the data ingestion tools.
            </p>
          </div>
          <Link
            to="/auth"
            className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            {authUserId ? "Manage" : "Sign in"}
          </Link>
        </section>



        <section className="mt-6">
          <h2 className="font-display text-xl font-bold">Streaming services</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(catalog?.services ?? []).map((service) => {
              const on = prefs.serviceSlugs.includes(service.slug);
              return (
                <button
                  key={service.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => prefsActions.toggleService(service.slug, !on)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    on
                      ? "border-coral bg-coral-soft text-coral"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {on ? <Check className="size-3" aria-hidden /> : null}
                  <BrandBadge
                    slug={service.slug}
                    label={service.short_name ?? service.name}
                    active={on}
                    className="border-none bg-transparent px-0 py-0 text-xs"
                  />
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold">Podcasts</h2>
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
                return (
                  <li
                    key={podcast.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
                  >
                    <Link
                      to="/podcasts/$slug"
                      params={{ slug: podcast.slug }}
                      className="flex min-w-0 flex-1 items-center gap-3 hover:text-coral"
                    >
                      <Artwork
                        src={podcast.artwork_url}
                        title={podcast.name}
                        seed={podcast.slug}
                        accent={podcast.accent}
                        shape="cover"
                        className="w-10 text-sm"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{podcast.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {rank.movieCount} movie{rank.movieCount === 1 ? "" : "s"} here ·{" "}
                          {podcast.episode_count} episodes · {rank.reason}
                        </span>
                      </span>
                    </Link>
                    {/* One consistent styling: filled = following, outline = not. */}
                    <button
                      type="button"
                      aria-pressed={preferred}
                      aria-label={
                        preferred ? `Unfollow ${podcast.name}` : `Follow ${podcast.name}`
                      }
                      onClick={() => prefsActions.togglePreferredPodcast(podcast.slug, !preferred)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        preferred
                          ? "border-transparent bg-berry text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Heart
                        className="size-3.5"
                        fill={preferred ? "currentColor" : "none"}
                        aria-hidden
                      />
                      {preferred ? "Following" : "Follow"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-10 rounded-2xl border border-dashed border-border bg-card p-5">
          <h2 className="font-display text-xl font-bold">Data sources</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pull real movie metadata, streaming availability, and podcast episodes from TMDB and Podcast Index.
          </p>
          <Link
            to="/admin/ingest"
            className="mt-4 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground neon"
          >
            Open ingestion tools
          </Link>
        </section>
      </main>
    </AppShell>
  );
}

/** Row-style switch used by the App settings block. */
function SettingToggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    <label className="mt-3 flex min-h-11 cursor-pointer items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        className="mt-1 size-5 shrink-0 accent-coral"
      />
    </label>
  );
}
