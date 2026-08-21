import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  id?: string;
  title: string;
  description?: string;
  /** Small right-aligned summary, e.g. a count. */
  badge?: ReactNode;
  defaultOpen?: boolean;
  /** Persist the open/closed state per card. */
  storageKey: string;
  children: ReactNode;
}

/** Admin sections collapse so the page stays scannable on a phone. */
export function CollapsibleCard({
  id,
  title,
  description,
  badge,
  defaultOpen = false,
  storageKey,
  children,
}: Props) {
  const key = `afterparty:admin-card:${storageKey}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === "open") setOpen(true);
      if (stored === "closed") setOpen(false);
    } catch {
      /* storage unavailable — keep the default */
    }
  }, [key]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(key, next ? "open" : "closed");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <section id={id} className="scroll-mt-4 rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold">{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
        {badge ? <span className="shrink-0 text-xs font-semibold text-coral">{badge}</span> : null}
      </button>
      {open ? (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <div className="mb-3 flex justify-end">
            <a
              href="#admin-top"
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowUp className="size-3" aria-hidden />
              Back to top
            </a>
          </div>
          {children}
        </div>
      ) : null}
    </section>
  );
}
