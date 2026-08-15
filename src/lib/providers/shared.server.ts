import { createHash } from "crypto";

export const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
export const PODCAST_INDEX_BASE = "https://api.podcastindex.org/api/1.0";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function normalizeTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikeJwt(value: string): boolean {
  return value.startsWith("eyJ") || /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

export async function tmdbFetch(path: string, apiKey: string, init?: RequestInit): Promise<unknown> {
  const isJwt = looksLikeJwt(apiKey);
  const url = new URL(path, TMDB_BASE);
  if (!isJwt) url.searchParams.set("api_key", apiKey);

  const headers = new Headers(init?.headers);
  if (isJwt) headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Accept", "application/json");

  const res = await fetch(url.toString(), { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`TMDB ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export function podcastIndexHeaders(apiKey: string, apiSecret: string): Record<string, string> {
  const now = Math.floor(Date.now() / 1000);
  const hash = createHash("sha1").update(apiKey + apiSecret + now).digest("hex");
  return {
    "X-Auth-Date": String(now),
    "X-Auth-Key": apiKey,
    Authorization: hash,
    Accept: "application/json",
    "User-Agent": "MovieAfterparty/1.0",
  };
}

export async function podcastIndexFetch(
  path: string,
  apiKey: string,
  apiSecret: string,
  init?: RequestInit,
): Promise<unknown> {
  const url = new URL(path, PODCAST_INDEX_BASE);
  const headers = podcastIndexHeaders(apiKey, apiSecret);
  if (init?.headers) {
    const extra = new Headers(init.headers);
    extra.forEach((v, k) => (headers[k] = v));
  }
  const res = await fetch(url.toString(), { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown");
    throw new Error(`Podcast Index ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}
