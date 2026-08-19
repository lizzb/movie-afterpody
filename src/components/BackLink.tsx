import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * Remembers where the user came from inside the app so detail pages can go
 * back to it (with the browser restoring scroll position) instead of always
 * jumping to a hardcoded tab.
 */
let previousPath: string | null = null;
let currentPath: string | null = null;

export function useTrackNavigation() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (currentPath !== pathname) {
      previousPath = currentPath;
      currentPath = pathname;
    }
  }, [pathname]);
}

const LABELS: { test: RegExp; label: string }[] = [
  { test: /^\/$/, label: "Tonight" },
  { test: /^\/movies\/[^/]+$/, label: "Movie" },
  { test: /^\/movies$/, label: "Movies" },
  { test: /^\/podcasts\/[^/]+$/, label: "Show" },
  { test: /^\/podcasts$/, label: "Shows" },
  { test: /^\/lists$/, label: "Lists" },
  { test: /^\/settings$/, label: "Setup" },
  { test: /^\/admin\/ingest$/, label: "Ingest" },
];

function labelFor(path: string | null, fallback: string): string {
  if (!path) return fallback;
  return LABELS.find((l) => l.test.test(path))?.label ?? "Back";
}

/**
 * Goes back through history when the user arrived from another in-app page,
 * so scroll position is restored; otherwise links to a sensible parent.
 */
export function BackLink({
  fallbackTo,
  fallbackLabel,
}: {
  fallbackTo: "/" | "/movies" | "/podcasts" | "/lists";
  fallbackLabel: string;
}) {
  const router = useRouter();
  // Snapshot on mount: navigating away should not relabel the button mid-view.
  const origin = useRef(previousPath);
  const canGoBack = typeof window !== "undefined" && window.history.length > 1 && origin.current;
  const className =
    "inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground";

  if (canGoBack) {
    return (
      <button type="button" onClick={() => router.history.back()} className={className}>
        <ArrowLeft className="size-4" aria-hidden />
        {labelFor(origin.current, fallbackLabel)}
      </button>
    );
  }

  return (
    <Link to={fallbackTo} className={className}>
      <ArrowLeft className="size-4" aria-hidden />
      {fallbackLabel}
    </Link>
  );
}
