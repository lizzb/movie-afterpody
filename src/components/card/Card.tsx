import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pass K2 — one card grammar shared by every list card in the app:
 * thumbnail / header (title + muted h2 or small-caps eyebrow + upper-right
 * controls) / badge subheader / body rows / footer (left float + trailing) /
 * optional expand-collapse footer.
 */
export function CardShell({
  children,
  className,
  dim = false,
}: {
  children: ReactNode;
  className?: string;
  dim?: boolean;
}) {
  return (
    <li
      className={cn(
        "relative rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-lg",
        dim && "opacity-45 saturate-50",
        className,
      )}
    >
      {children}
    </li>
  );
}

/** Upper-right control cluster, floated clear of the card body. */
export function CardControls({ children }: { children: ReactNode }) {
  return (
    <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">{children}</div>
  );
}

/**
 * Reserved gutter sized to the number of 32px controls actually floated, so a
 * two-control card does not force its title to wrap for room it never uses.
 */
const RESERVE: Record<number, string> = { 1: "pr-12", 2: "pr-[5.5rem]", 3: "pr-[7.5rem]" };

export function CardHeader({
  eyebrow,
  title,
  h2,
  reserveRight = false,
}: {
  /** Small-caps line above the title, e.g. the show name or the release date. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Muted secondary text inline with the title, e.g. the release year. */
  h2?: ReactNode;
  /** Leave room for the floated upper-right controls — `true` means two. */
  reserveRight?: boolean | 1 | 2 | 3;
}) {
  const slots = reserveRight === true ? 2 : reserveRight === false ? 0 : reserveRight;
  return (
    <div className={slots ? RESERVE[slots] : undefined}>

      {eyebrow ? (
        <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h3
        className={cn(
          "font-display text-base font-bold leading-snug",
          eyebrow ? "mt-0.5 text-sm font-semibold" : "",
        )}
      >
        {title}
        {h2 ? <span className="font-normal text-muted-foreground"> {h2}</span> : null}
      </h3>
    </div>
  );
}

export function CardBadges({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold">
      {children}
    </div>
  );
}

export function CardBody({ children }: { children: ReactNode }) {
  return <div className="mt-2 space-y-1 text-xs text-muted-foreground">{children}</div>;
}

/** One body row: content left, an optional control pinned right. */
export function CardBodyRow({
  children,
  control,
}: {
  children: ReactNode;
  control?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="min-w-0 flex-1">{children}</span>
      {control ? <span className="shrink-0">{control}</span> : null}
    </div>
  );
}

export function CardFooter({
  children,
  trailing,
}: {
  children?: ReactNode;
  /** Right-aligned text or actions. */
  trailing?: ReactNode;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {children}
      {trailing ? <span className="ml-auto flex items-center gap-1.5">{trailing}</span> : null}
    </div>
  );
}

/** Collapsed footer strip that opens extra controls in place. */
export function CardExpand({
  label,
  openLabel,
  children,
}: {
  label: string;
  openLabel?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
        {open ? (openLabel ?? label) : label}
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
