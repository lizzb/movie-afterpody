import { normalizeTitle } from "./shared.server";

export interface MovieMatchCandidate {
  movieId: string;
  title: string;
  releaseYear: number | null;
  confidence: number;
  reason: string;
}

const YEAR_RE = /\b(19\d{2}|20\d{2})\b/;

function extractYear(title: string): number | null {
  const m = title.match(YEAR_RE);
  return m ? Number(m[1]) : null;
}

function removeYear(title: string): string {
  return title.replace(YEAR_RE, "").replace(/\s+/g, " ").trim();
}

function tokenSet(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

export function matchEpisodeToMovies(
  episodeTitle: string,
  movies: { id: string; title: string; release_year: number | null }[],
): MovieMatchCandidate[] {
  const episodeYear = extractYear(episodeTitle);
  const episodeNoYear = removeYear(episodeTitle);
  const episodeTokens = tokenSet(episodeNoYear);

  const candidates: MovieMatchCandidate[] = movies.map((movie) => {
    const movieTokens = tokenSet(movie.title);
    const movieLower = normalizeTitle(movie.title);
    const episodeLower = normalizeTitle(episodeNoYear);

    let confidence = 0;
    let reason = "";

    // Exact or near-exact title containment
    if (episodeLower === movieLower) {
      confidence = 100;
      reason = "exact title";
    } else if (episodeLower.includes(movieLower) || movieLower.includes(episodeLower)) {
      confidence = 90;
      reason = "title contained";
    } else {
      const similarity = jaccard(episodeTokens, movieTokens);
      if (similarity >= 0.85) {
        confidence = 85;
        reason = "near-exact tokens";
      } else if (similarity >= 0.6) {
        confidence = 70;
        reason = "strong token overlap";
      } else if (similarity >= 0.4) {
        confidence = 55;
        reason = "moderate token overlap";
      } else if ([...movieTokens].every((t) => episodeTokens.has(t))) {
        confidence = 60;
        reason = "all movie words present";
      } else {
        confidence = Math.round(similarity * 100);
        reason = "token overlap";
      }
    }

    // Year bonus/penalty
    if (movie.release_year && episodeYear) {
      if (movie.release_year === episodeYear) {
        confidence = Math.min(100, confidence + 10);
        reason += " + year match";
      } else if (Math.abs(movie.release_year - episodeYear) <= 1) {
        confidence = Math.min(100, confidence + 3);
        reason += " + year near";
      } else if (confidence < 80) {
        confidence = Math.max(0, confidence - 15);
        reason += " - year mismatch";
      }
    }

    return {
      movieId: movie.id,
      title: movie.title,
      releaseYear: movie.release_year,
      confidence,
      reason,
    };
  });

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.filter((c) => c.confidence >= 25);
}
