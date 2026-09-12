import { AlertTriangle } from "lucide-react";

/**
 * Shown when a list query itself failed. Without this, a failed catalogue read
 * was indistinguishable from an empty catalogue: the hooks default to [] and the
 * page rendered a normal header above nothing.
 */
export function ListErrorNotice({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  if (!error) return null;
  const detail = error instanceof Error ? error.message : String(error);
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-foreground"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">This list couldn&apos;t be loaded.</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nothing is missing from your catalogue — the request failed. Try again in a moment.
          </p>
          <p className="mt-1 break-words text-[11px] text-muted-foreground/80">{detail}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
