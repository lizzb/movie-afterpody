import { Link } from "@tanstack/react-router";
import { Bookmark, Clapperboard, Database, Mic, Popcorn, Settings, Sparkles, UserRound } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { ThemeToggle, useThemeClass } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePrefs } from "@/lib/prefs";

/**
 * Pass G — viewport lock. On by default: keeps the layout fixed so a stray
 * two-finger drag cannot zoom or pan. The Setup toggle restores pinch zoom for
 * accessibility (iOS Safari only honours the lock inside an installed app).
 */
function useViewportLock(locked: boolean) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    meta.setAttribute(
      "content",
      locked
        ? "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        : "width=device-width, initial-scale=1, viewport-fit=cover",
    );
  }, [locked]);
}

const TABS = [
  { to: "/", label: "Tonight", icon: Sparkles },
  { to: "/movies", label: "Movies", icon: Clapperboard },
  { to: "/podcasts", label: "Shows", icon: Mic },
  { to: "/lists", label: "Lists", icon: Bookmark },
  { to: "/settings", label: "Setup", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  useThemeClass();
  const prefs = usePrefs();
  useViewportLock(prefs.viewportLock);
  const { userId, user } = useAuth();
  const isAdmin = useIsAdmin();
  const accountLabel = userId ? (user?.email ?? "Signed in") : "Sign in";

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      {/* Desktop only: mobile relies on each page's own H1 plus the bottom nav. */}
      <header className="sticky top-0 z-20 hidden border-b border-border/70 bg-background/85 backdrop-blur md:block">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-2.5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-display text-base font-bold tracking-tight"
          >
            <Popcorn className="size-5 text-coral" aria-hidden />
            Movie&nbsp;Afterparty
          </Link>
          <nav className="flex items-center gap-1">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                activeOptions={{ exact: tab.to === "/" }}
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "bg-coral-soft text-coral" }}
              >
                {tab.label}
              </Link>
            ))}
            {isAdmin ? (
              <Link
                to="/admin/ingest"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "bg-coral-soft text-coral" }}
              >
                <Database className="size-4" aria-hidden />
                Ingest
              </Link>
            ) : null}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/auth"
              aria-label={accountLabel}
              title={accountLabel}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                userId
                  ? "border-transparent bg-teal-soft text-teal"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserRound className="size-4" aria-hidden />
              <span className="max-w-32 truncate">{userId ? "Signed in" : "Sign in"}</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile: slim account strip so sign-in state is always visible and reachable. */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border/70 bg-background/90 px-4 py-2 backdrop-blur md:hidden">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 font-display text-sm font-bold tracking-tight"
        >
          <Popcorn className="size-4 text-coral" aria-hidden />
          Movie&nbsp;Afterparty
        </Link>
        <div className="flex items-center gap-1.5">
          {isAdmin ? (
            <Link
              to="/admin/ingest"
              aria-label="Data ingestion tools"
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground"
              activeProps={{ className: "border-transparent bg-coral-soft text-coral" }}
            >
              <Database className="size-3.5" aria-hidden />
              Ingest
            </Link>
          ) : null}
          <ThemeToggle />
          <Link
            to="/auth"
            aria-label={accountLabel}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              userId
                ? "border-transparent bg-teal-soft text-teal"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            <UserRound className="size-3.5" aria-hidden />
            {userId ? "Signed in" : "Sign in"}
          </Link>
        </div>
      </div>


      {children}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-md">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                activeOptions={{ exact: tab.to === "/" }}
                className="group flex flex-col items-center gap-1 py-2 text-[11px] font-semibold text-muted-foreground"
                activeProps={{ className: "text-coral" }}
              >
                {({ isActive }: { isActive: boolean }) => (
                  <>
                    <span
                      className={`grid place-items-center rounded-full px-3.5 py-1 transition-colors ${
                        isActive ? "bg-coral-soft neon" : ""
                      }`}
                    >
                      <tab.icon
                        className="size-5"
                        strokeWidth={isActive ? 2.6 : 2}
                        aria-hidden
                      />
                    </span>
                    {tab.label}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
