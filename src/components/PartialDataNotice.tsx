import { AlertTriangle } from "lucide-react";

/**
 * Pass U79 — shown when part of the catalogue failed to load. The page keeps
 * whatever arrived instead of going blank, and says so plainly.
 */
export function PartialDataNotice({ show }: { show: boolean | undefined }) {
  if (!show) return null;
  return (
    <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Some titles couldn&apos;t be loaded just now, so this page may be incomplete. Pull to refresh or try again in a
        moment.
      </span>
    </div>
  );
}
