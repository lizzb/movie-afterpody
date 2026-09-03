import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Pass U14 — one click-ordered queue for every primary admin/ingest action.
 *
 * Before this, each card owned its own in-flight flag and the coverage card had a
 * single `busyId`, so a second click either raced the first request or silently
 * abandoned it. Now every action is enqueued in click order and executed one at a
 * time: nothing is dropped, nothing overlaps, and each action reports its own
 * result. Duplicate presses of the *same* action while it is still pending are
 * ignored rather than queued twice.
 */

export type QueueStatus = "idle" | "queued" | "running";

type QueueItem = { id: string; key: string; label: string };
type QueueResult = { id: string; label: string; ok: boolean; message: string };

type AdminQueue = {
  /** Enqueue work. Rejects immediately if the same key is already pending. */
  run: <T>(key: string, label: string, work: () => Promise<T>, describe?: (value: T) => string) => Promise<T>;
  status: (key: string) => QueueStatus;
  /** True while anything at all is queued or running. */
  busy: boolean;
  items: QueueItem[];
  runningId: string | null;
  results: QueueResult[];
  clearResults: () => void;
};

const AdminQueueContext = createContext<AdminQueue | null>(null);

export class DuplicateActionError extends Error {
  constructor(label: string) {
    super(`${label} is already running — waiting for it to finish.`);
    this.name = "DuplicateActionError";
  }
}

export function AdminActionQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [results, setResults] = useState<QueueResult[]>([]);
  // The chain is what actually serialises: each new action waits on the last.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pendingKeys = useRef<Set<string>>(new Set());

  const run = useCallback<AdminQueue["run"]>((key, label, work, describe) => {
    if (pendingKeys.current.has(key)) {
      return Promise.reject(new DuplicateActionError(label));
    }
    const id = `${key}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
    pendingKeys.current.add(key);
    setItems((prev) => [...prev, { id, key, label }]);

    const task = chain.current.then(async () => {
      setRunningId(id);
      try {
        const value = await work();
        setResults((prev) =>
          [{ id, label, ok: true, message: describe?.(value) ?? "done" }, ...prev].slice(0, 25),
        );
        return value;
      } catch (e) {
        setResults((prev) =>
          [{ id, label, ok: false, message: (e as Error).message }, ...prev].slice(0, 25),
        );
        throw e;
      } finally {
        pendingKeys.current.delete(key);
        setRunningId((cur) => (cur === id ? null : cur));
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    });

    // Keep the chain alive after a failure so later actions still run.
    chain.current = task.catch(() => undefined);
    return task as Promise<never>;
  }, []);

  const value = useMemo<AdminQueue>(
    () => ({
      run,
      status: (key) => {
        const item = items.find((i) => i.key === key);
        if (!item) return "idle";
        return item.id === runningId ? "running" : "queued";
      },
      busy: items.length > 0,
      items,
      runningId,
      results,
      clearResults: () => setResults([]),
    }),
    [run, items, runningId, results],
  );

  return <AdminQueueContext.Provider value={value}>{children}</AdminQueueContext.Provider>;
}

export function useAdminQueue(): AdminQueue {
  const ctx = useContext(AdminQueueContext);
  if (!ctx) throw new Error("useAdminQueue must be used inside AdminActionQueueProvider");
  return ctx;
}

/** Per-action helper: label, status and a click guard in one place. */
export function useQueuedAction(key: string, label: string) {
  const queue = useAdminQueue();
  const status = queue.status(key);
  return {
    status,
    pending: status !== "idle",
    queued: status === "queued",
    running: status === "running",
    /** Swallows the duplicate-press rejection; real failures still throw. */
    start: <T,>(work: () => Promise<T>, describe?: (value: T) => string) =>
      queue.run(key, label, work, describe),
  };
}

/** Sticky readout so a queued action is never invisible. */
export function AdminQueueStatus() {
  const { items, runningId, results, clearResults } = useAdminQueue();
  const active = items.find((i) => i.id === runningId) ?? items[0] ?? null;
  const waiting = items.filter((i) => i.id !== active?.id);
  const failures = results.filter((r) => !r.ok).slice(0, 4);

  if (!active && failures.length === 0) return null;

  return (
    <div className="sticky top-2 z-20 mt-4 rounded-2xl border border-border bg-card/95 px-4 py-3 backdrop-blur">
      {active ? (
        <>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Loader2 className="size-4 animate-spin text-teal" aria-hidden />
            {active.label}
            {waiting.length > 0 ? (
              <span className="font-normal text-muted-foreground">
                · {waiting.length} waiting
              </span>
            ) : null}
          </p>
          {waiting.length > 0 ? (
            <ol className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {waiting.slice(0, 5).map((i, idx) => (
                <li key={i.id} className="break-anywhere">
                  {idx + 1}. {i.label}
                </li>
              ))}
              {waiting.length > 5 ? <li>+{waiting.length - 5} more</li> : null}
            </ol>
          ) : null}
        </>
      ) : null}

      {failures.length > 0 ? (
        <div className="mt-2 space-y-0.5">
          {failures.map((r) => (
            <p key={r.id} className="break-anywhere text-xs text-destructive">
              <span className="font-semibold">{r.label}</span>: {r.message}
            </p>
          ))}
          <button
            type="button"
            onClick={clearResults}
            className="mt-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}
