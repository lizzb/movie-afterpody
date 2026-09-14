/**
 * Pass U55 — deterministic episode-title parsing stage.
 *
 * Splits a podcast episode title into role-labelled segments *before* any
 * scoring happens, so guest credits ("… with Colby Day", "w/ Billy Ray
 * Brewton") stop being treated as movie-title evidence.
 *
 * Deliberately conservative: a split only happens when the separator is
 * surrounded by spaces (or bracketed) and the trailing text looks like a list
 * of person names. Callers that know the catalogue can still test the whole
 * original string for an exact title match, so genuine titles containing
 * "With" are never broken by this stage.
 */

export type SegmentRole = "prefix" | "title" | "guest";

export interface TitleSegment {
  role: SegmentRole;
  text: string;
}

export interface ParsedEpisodeTitle {
  /** Episode-number / format prefix that was removed, if any. */
  prefixText: string;
  /** The title-bearing remainder — the only segment that carries title evidence. */
  titleText: string;
  /** Guest credit text, or "" when none was detected. */
  guestText: string;
  segments: TitleSegment[];
}

/** Episode-number / bonus prefixes that dilute a title comparison. */
const PREFIXES = [
  /^ep(isode)?\.?\s*#?\d+\s*[:\-–—|]?\s*/i,
  /^#\d+\s*[:\-–—|]?\s*/,
  /^\d{1,4}\s*[:\-–—|]\s*/,
  /^s\d+\s*e\d+\s*[:\-–—|]?\s*/i,
  /^(bonus|mini(sode)?|patreon|preview|encore|classic|rewatch|revisit|live)\s*[:\-–—|]\s*/i,
];

const GUEST_MARKER = String.raw`(?:with|w\/|w\.|feat\.?|featuring|ft\.?)`;

/** "( with Amy Smart )" / "[w/ Blake Howard]" at the very end. */
const BRACKETED_GUEST = new RegExp(String.raw`[([]\s*${GUEST_MARKER}\s+([^)\]]{2,80})[)\]]\s*$`, "i");

/** "… with Colby Day" / "… - w/ Danette Chavez & Amy Smart" at the very end. */
const TRAILING_GUEST = new RegExp(String.raw`\s+(?:[-–—|,:]\s*)?${GUEST_MARKER}\s+(.{2,80})$`, "i");

const NAME_PARTICLES = new Set([
  "de",
  "del",
  "della",
  "di",
  "da",
  "van",
  "von",
  "der",
  "la",
  "le",
  "mc",
  "mac",
  "st",
  "jr",
  "sr",
  "ii",
  "iii",
  "and",
  "the",
]);

/**
 * True when the trailing text reads like one to four person names, e.g.
 * "Colby Day", "Danette Chavez & Amy Smart", "Billy Ray Brewton and Amanda Smith".
 */
export function looksLikeGuestNames(input: string): boolean {
  const text = input.trim().replace(/[.,;:!?\s]+$/g, "");
  if (!text || text.length > 70) return false;
  if (/\d/.test(text)) return false;
  if (/["“”:;/]/.test(text)) return false;

  const parts = text
    .split(/\s*(?:,|&|\band\b|\+)\s*/i)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > 4) return false;

  for (const part of parts) {
    const words = part.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) return false;
    let capitalised = 0;
    for (const word of words) {
      const bare = word.replace(/[^A-Za-z'’-]/g, "");
      if (!bare) return false;
      const lower = bare.toLowerCase().replace(/[.'’-]/g, "");
      if (/^[A-Z]/.test(bare)) capitalised += 1;
      else if (!NAME_PARTICLES.has(lower)) return false;
    }
    // At least one capitalised word per name, and names are mostly capitalised.
    if (capitalised === 0) return false;
  }
  return true;
}

function stripPrefixes(input: string): { prefix: string; rest: string } {
  let rest = input.trim();
  let prefix = "";
  for (let i = 0; i < 3; i += 1) {
    let changed = false;
    for (const re of PREFIXES) {
      const next = rest.replace(re, "");
      if (next !== rest) {
        prefix += rest.slice(0, rest.length - next.length);
        rest = next.trim();
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { prefix: prefix.trim(), rest };
}

/** Splits an episode title into prefix / title / guest segments. */
export function parseEpisodeTitle(episodeTitle: string): ParsedEpisodeTitle {
  const { prefix, rest } = stripPrefixes(episodeTitle ?? "");
  let titleText = rest;
  let guestText = "";

  const bracketed = titleText.match(BRACKETED_GUEST);
  if (bracketed?.[1] && looksLikeGuestNames(bracketed[1])) {
    guestText = bracketed[1].trim();
    titleText = titleText.slice(0, bracketed.index ?? titleText.length).trim();
  } else {
    const trailing = titleText.match(TRAILING_GUEST);
    if (trailing?.[1] && looksLikeGuestNames(trailing[1])) {
      const head = titleText.slice(0, trailing.index ?? titleText.length).trim();
      const headWords = head.split(/\s+/).filter(Boolean).length;
      const spelledOut = /^\s*[-–—|,:]?\s*with\b/i.test(
        titleText.slice(trailing.index ?? 0),
      );
      // Never leave an empty or one-word title behind: "Sleeping with Other
      // People" must not become "Sleeping". Abbreviated markers (w/, feat.) are
      // never part of a film title, so a one-word head is fine for those.
      const headOk = head.replace(/[^A-Za-z0-9]/g, "").length >= 2 && (headWords >= 2 || !spelledOut);
      if (headOk) {
        guestText = trailing[1].trim();
        titleText = head;
      }
    }
  }

  titleText = titleText.replace(/[\s\-–—|:,]+$/g, "").trim();

  const segments: TitleSegment[] = [];
  if (prefix) segments.push({ role: "prefix", text: prefix });
  if (titleText) segments.push({ role: "title", text: titleText });
  if (guestText) segments.push({ role: "guest", text: guestText });

  return { prefixText: prefix, titleText: titleText || rest, guestText, segments };
}
