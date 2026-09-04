import { accentFor, accentSolid, toAccent } from "@/lib/accents";

interface Props {
  src?: string | null;
  title: string;
  /** Any string; used for the deterministic fallback accent. */
  seed: string;
  accent?: string | null;
  /** poster = 2:3 movie poster, cover = 1:1 podcast cover art, circle = round cover. */
  shape?: "poster" | "cover" | "circle";
  className?: string;
}

/**
 * Movie poster / podcast cover art with a typographic accent fallback so
 * un-ingested rows still read as identifiable artwork.
 */
export function Artwork({ src, title, seed, accent, shape = "poster", className = "" }: Props) {
  const tone = toAccent(accent ?? accentFor(seed));
  const ratio = shape === "poster" ? "aspect-[2/3]" : "aspect-square";
  const radius = shape === "circle" ? "rounded-full" : "rounded-xl";

  return (
    <div
      className={`relative shrink-0 overflow-hidden ${radius} ${ratio} ${className}`}

      aria-hidden
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <div
          className={`grid size-full place-items-center font-display text-[1.6em] font-bold ${accentSolid(tone)}`}
        >
          {title.slice(0, 1).toUpperCase()}
        </div>
      )}
    </div>
  );
}
