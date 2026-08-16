import type { ReactElement, SVGProps } from "react";

/**
 * Bundled monochrome brand glyphs. Simplified single-path marks drawn in
 * `currentColor` so they read as iconography, not as brand color clutter.
 * Anything unknown falls back to an initial glyph.
 */
type Glyph = (props: SVGProps<SVGSVGElement>) => ReactElement;

const svg = (children: ReactElement): Glyph =>
  function BrandGlyph(props: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
        {children}
      </svg>
    );
  };

const NETFLIX = svg(
  <path d="M7 2h3.2l6.1 14.4V2H20v20h-3.2L10.7 7.6V22H7V2z" />,
);
const PRIME = svg(
  <path d="M2.6 15.6c3.2 2.3 6.9 3.4 10.9 3.4 2.8 0 5.6-.6 8.2-1.8.5-.2.9.2.4.6-2.4 1.9-5.7 2.9-8.7 2.9-4.2 0-8-1.6-10.9-4.3-.3-.3-.1-.9.1-.8zm18.7-.9c-.4-.5-2.5-.3-3.5-.1-.3.1-.4-.2-.1-.4 1.6-1.1 4.2-.8 4.5-.4.3.4-.1 3-1.6 4.2-.2.2-.5.1-.4-.2.4-.9 1.1-2.7.7-3.1zM6.4 5.1h2v1c.7-.8 1.6-1.2 2.6-1.2 2.1 0 3.5 1.7 3.5 4.3s-1.5 4.4-3.7 4.4c-.9 0-1.7-.3-2.3-1v3.6h-2V5.1zm2 4.1c0 1.6.8 2.6 1.9 2.6s1.9-1 1.9-2.6-.7-2.5-1.9-2.5-1.9 1-1.9 2.5z" />,
);
const DISNEY = svg(
  <path d="M12 2c1.1 0 2 .9 2 2v6h6c1.1 0 2 .9 2 2s-.9 2-2 2h-6v6c0 1.1-.9 2-2 2s-2-.9-2-2v-6H4c-1.1 0-2-.9-2-2s.9-2 2-2h6V4c0-1.1.9-2 2-2z" />,
);
const MAX = svg(
  <path d="M2 6h2.6l1.6 5.2L7.8 6h2.6l-2.7 12H5.5l1.1-5-.9-2.8L4.3 18H2L2 6zm10.6 0h2.3l2.6 12h-2.3l-.4-2.2h-2.3l-.4 2.2h-2.3l2.8-12zm.8 3.3-.7 4.2h1.5l-.8-4.2zM18 6h2.3l.9 3.4L22.2 6H24l-1.7 5.6L24 18h-2.2l-1-3.8-1.1 3.8H18l1.8-6.4L18 6z" />,
);
const HULU = svg(
  <path d="M2 4h3v6.2c.6-.7 1.5-1.1 2.6-1.1 2 0 3.4 1.3 3.4 3.5V20H8v-6.6c0-1-.5-1.6-1.4-1.6S5 12.4 5 13.4V20H2V4zm11 5.3h3v6.4c0 1 .5 1.6 1.4 1.6s1.6-.6 1.6-1.6V9.3h3V20h-3v-1c-.6.7-1.5 1.2-2.6 1.2-2 0-3.4-1.4-3.4-3.6V9.3z" />,
);
const APPLE = svg(
  <path d="M16.4 12.7c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.3-2.5 1.3-2.6-.1 0-2.8-1.1-2.8-4zM14.3 5.9c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3z" />,
);
const PARAMOUNT = svg(<path d="M12 2 22 20H2L12 2zm0 5.5L6.6 17.5h10.8L12 7.5z" />);
const PEACOCK = svg(
  <path d="M12 2c4 0 6.6 3 6.6 6.7 0 3.2-2 5.2-4 6.4l.7 6.9h-2l-.6-6h-1.4l-.6 6h-2l.7-6.9c-2-1.2-4-3.2-4-6.4C5.4 5 8 2 12 2zm0 3.4a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z" />,
);
const SHUDDER = svg(
  <path d="M12 2c3 4.4 6 7 6 11a6 6 0 1 1-12 0c0-4 3-6.6 6-11zm0 5.6c-1.8 3-3.4 4.7-3.4 6.4a3.4 3.4 0 0 0 6.8 0c0-1.7-1.6-3.4-3.4-6.4z" />,
);
const TUBI = svg(
  <path d="M3 6h8v3H8v9H6V9H3V6zm10 0h2v7.5c0 1.4.8 2.2 2 2.2s2-.8 2-2.2V6h2v7.6c0 2.6-1.7 4.4-4 4.4s-4-1.8-4-4.4V6z" />,
);
const SPOTIFY = svg(
  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.5c-.2.3-.6.4-.9.2-2.5-1.5-5.7-1.9-9.4-1.1-.4.1-.7-.1-.8-.5-.1-.4.1-.7.5-.8 4-.9 7.5-.5 10.3 1.2.3.2.4.6.3 1zm1.2-2.9c-.3.4-.7.5-1.1.3-2.9-1.8-7.2-2.3-10.6-1.3-.4.1-.9-.1-1-.6-.1-.4.1-.9.6-1 3.9-1.2 8.7-.6 12 1.5.4.2.5.7.1 1.1zm.1-3c-3.4-2-9.1-2.2-12.4-1.2-.5.2-1.1-.1-1.3-.7-.2-.5.1-1.1.7-1.3 3.8-1.2 10-.9 13.9 1.4.5.3.7 1 .4 1.5-.3.4-.9.6-1.3.3z" />,
);
const POCKETCASTS = svg(
  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.1a6.9 6.9 0 0 1 6.9 6.9h-2.4A4.5 4.5 0 1 0 12 16.5V19a7 7 0 0 1 0-13.9z" />,
);
const OVERCAST = svg(
  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.6 3.4 10.9-3.4-2.3-3.4 2.3L12 5.6z" />,
);
const YOUTUBE = svg(
  <path d="M21.6 7.2c-.2-1-1-1.8-2-2C17.8 4.8 12 4.8 12 4.8s-5.8 0-7.6.4c-1 .2-1.8 1-2 2C2 9 2 12 2 12s0 3 .4 4.8c.2 1 1 1.8 2 2 1.8.4 7.6.4 7.6.4s5.8 0 7.6-.4c1-.2 1.8-1 2-2C22 15 22 12 22 12s0-3-.4-4.8zM10 15.5v-7l6 3.5-6 3.5z" />,
);

const GLYPHS: Record<string, Glyph> = {
  netflix: NETFLIX,
  "prime-video": PRIME,
  "amazon-prime-video": PRIME,
  prime: PRIME,
  "disney-plus": DISNEY,
  disney: DISNEY,
  max: MAX,
  hbo: MAX,
  "hbo-max": MAX,
  hulu: HULU,
  "apple-tv-plus": APPLE,
  "apple-tv": APPLE,
  appletv: APPLE,
  "paramount-plus": PARAMOUNT,
  paramount: PARAMOUNT,
  peacock: PEACOCK,
  shudder: SHUDDER,
  tubi: TUBI,
  spotify: SPOTIFY,
  "apple-podcasts": APPLE,
  apple: APPLE,
  "pocket-casts": POCKETCASTS,
  pocketcasts: POCKETCASTS,
  overcast: OVERCAST,
  youtube: YOUTUBE,
  "youtube-music": YOUTUBE,
};

export function brandGlyph(slug: string): Glyph | null {
  return GLYPHS[slug.toLowerCase()] ?? null;
}

interface BadgeProps {
  slug: string;
  label: string;
  /** Show the wordmark text next to the glyph. */
  showLabel?: boolean;
  /** Emphasised styling for services the user actually subscribes to. */
  active?: boolean;
  href?: string | null;
  className?: string;
}

const BASE =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none transition-colors";

/**
 * Self-contained brand badge: glyph plus optional wordmark, never plain text.
 */
export function BrandBadge({
  slug,
  label,
  showLabel = true,
  active = false,
  href,
  className = "",
}: BadgeProps) {
  const Glyph = brandGlyph(slug);
  const tone = active
    ? "border-transparent bg-coral-soft text-coral"
    : "border-border bg-secondary text-secondary-foreground";

  const inner = (
    <>
      {Glyph ? (
        <Glyph className="size-3.5" />
      ) : (
        <span className="grid size-3.5 place-items-center rounded-sm bg-current/20 text-[9px] font-bold">
          {label.slice(0, 1)}
        </span>
      )}
      {showLabel ? <span className="max-w-28 truncate">{label}</span> : null}
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        title={label}
        aria-label={label}
        className={`${BASE} ${tone} hover:text-foreground ${className}`}
      >
        {inner}
      </a>
    );
  }

  return (
    <span title={label} aria-label={label} className={`${BASE} ${tone} ${className}`}>
      {inner}
    </span>
  );
}
