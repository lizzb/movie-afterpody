// Extracts a likely movie title from a podcast episode title.
// Lightweight, deterministic heuristics — no AI needed.

const NOISE_PREFIXES = [
  /^ep(isode)?\.?\s*#?\d+\s*[:\-–—|]\s*/i,
  /^#\d+\s*[:\-–—|]\s*/,
  /^\d{1,4}\s*[:\-–—|]\s*/,
  /^s\d+e\d+\s*[:\-–—|]\s*/i,
  /^(bonus|mini(sode)?|minisode|patreon|preview|re-?release|encore|classic|rewatch|revisit|live)\s*[:\-–—|]\s*/i,
];

const NOISE_SUFFIXES = [
  /\s*[\-–—|:]\s*(with|w\/|feat\.?|featuring|ft\.?)\s+.+$/i,
  /\s*\(\s*(with|w\/|feat\.?|featuring|ft\.?)\s+[^)]*\)\s*$/i,
  /\s*\(\s*(re-?release|rerun|encore|part\s*\d+|pt\.?\s*\d+|live|bonus|patreon)\s*\)\s*$/i,
  /\s*[\-–—|]\s*(part\s*\d+|pt\.?\s*\d+)\s*$/i,
];

const SKIP_PATTERNS = [
  /\btrailer\b/i,
  /\bintroducing\b/i,
  /\blisten now\b/i,
  /\bannouncement\b/i,
  /\bq\s*&\s*a\b/i,
  /\bmailbag\b/i,
  /\bhouse ?keeping\b/i,
  /\bpatreon preview\b/i,
];

const YEAR_RE = /\(?\b(19\d{2}|20\d{2})\b\)?/;

export interface ExtractedTitle {
  title: string;
  year: number | null;
}

/** True when the episode is almost certainly not about a single movie. */
export function looksNonMovieEpisode(episodeTitle: string): boolean {
  return SKIP_PATTERNS.some((re) => re.test(episodeTitle));
}

export function hasUsableEpisodeTitle(episodeTitle: string): boolean {
  const title = episodeTitle.trim();
  return title.length > 0 && !/^untitled episode\b/i.test(title);
}

function stripNoise(input: string): string {
  let out = input.trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of NOISE_PREFIXES) {
      const next = out.replace(re, "");
      if (next !== out) {
        out = next.trim();
        changed = true;
      }
    }
    for (const re of NOISE_SUFFIXES) {
      const next = out.replace(re, "");
      if (next !== out) {
        out = next.trim();
        changed = true;
      }
    }
  }
  return out.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim();
}

/**
 * Returns ordered candidate movie titles for a podcast episode title, best first.
 */
export function extractMovieTitleCandidates(episodeTitle: string): ExtractedTitle[] {
  if (!hasUsableEpisodeTitle(episodeTitle)) return [];
  const cleaned = stripNoise(episodeTitle);
  if (!cleaned) return [];

  const yearMatch = cleaned.match(YEAR_RE);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const withoutYear = cleaned.replace(YEAR_RE, "").replace(/\(\s*\)/g, "").replace(/\s+/g, " ").trim();

  const candidates: ExtractedTitle[] = [];
  const push = (title: string, y: number | null) => {
    const t = title.replace(/[\s\-–—|:,]+$/g, "").replace(/^[\s\-–—|:,]+/g, "").trim();
    if (t.length < 2) return;
    if (candidates.some((c) => c.title.toLowerCase() === t.toLowerCase() && c.year === y)) return;
    candidates.push({ title: t, year: y });
  };

  push(withoutYear, year);

  // Quoted title wins if present: e.g. Ep 12: We watched "Speed"
  const quoted = cleaned.match(/["“](.{2,80}?)["”]/);
  if (quoted?.[1]) candidates.unshift({ title: quoted[1].trim(), year });

  // Take the segment before a separator, in case the show appends chatter.
  const firstSegment = withoutYear.split(/\s*[|–—]\s*|\s+[-]\s+/)[0];
  if (firstSegment) push(firstSegment, year);

  // Drop trailing "with X" style chatter that survived, plus leading verbs.
  push(withoutYear.replace(/^(we\s+watched|watching|revisiting|reviewing|discussing)\s+/i, ""), year);

  // Year-less fallback so TMDB can still resolve when the year is the release of the episode.
  if (year) push(withoutYear, null);

  return candidates.slice(0, 4);
}
