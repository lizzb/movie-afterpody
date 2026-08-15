import { Link } from "@tanstack/react-router";
import { Bookmark, Clapperboard, Mic, Settings, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

const TABS = [
  { to: "/", label: "Tonight", icon: Sparkles },
  { to: "/movies", label: "Movies", icon: Clapperboard },
  { to: "/podcasts", label: "Shows", icon: Mic },
  { to: "/lists", label: "Lists", icon: Bookmark },
  { to: "/settings", label: "Setup", icon: Settings },
] as const;


export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="font-display text-lg tracking-tight">
            Movie&nbsp;Afterparty
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                activeOptions={{ exact: tab.to === "/" }}
                className="rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {children}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-md">
          {TABS.map((tab) => (
            <li key={tab.to} className="flex-1">
              <Link
                to={tab.to}
                activeOptions={{ exact: tab.to === "/" }}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted-foreground"
                activeProps={{ className: "text-coral" }}
              >
                <tab.icon className="size-5" aria-hidden />
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
