import * as cheerio from "cheerio";
import { normalizeUrl } from "@/lib/parsing/normalize-url";
import { isRejectedPath } from "@/lib/parsing/reject-patterns";

const DATED_PATH_PATTERN = /\/\d{4}\/\d{1,2}(\/\d{1,2})?\//;
const TRAILING_NUMERIC_ID_PATTERN = /-\d{6,}(\/|$)/;

function looksLikeArticlePath(pathname: string): boolean {
  if (DATED_PATH_PATTERN.test(pathname)) {
    return true;
  }
  if (TRAILING_NUMERIC_ID_PATTERN.test(pathname)) {
    return true;
  }

  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] ?? "";
  const hyphenCount = (lastSegment.match(/-/g) ?? []).length;

  return lastSegment.length >= 20 && hyphenCount >= 3;
}

/**
 * Homepage HTML -> filtered, deduped candidate article URLs (AGENTS.md
 * sections 11-12). Approximates "visible story card" links via URL-shape
 * heuristics: same-origin, not on the non-article reject list, and shaped
 * like an article URL (dated path, or a long multi-hyphen slug, or a
 * trailing numeric ID).
 */
export function extractCandidateLinks(homepageHtml: string, sourceUrl: string): string[] {
  const $ = cheerio.load(homepageHtml);
  const sourceOrigin = new URL(sourceUrl).origin;
  const seen = new Set<string>();
  const candidates: string[] = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) {
      return;
    }

    const normalized = normalizeUrl(href, sourceUrl);
    if (!normalized) {
      return;
    }

    const url = new URL(normalized);
    if (url.origin !== sourceOrigin) {
      return;
    }

    if (isRejectedPath(url.pathname)) {
      return;
    }

    if (!looksLikeArticlePath(url.pathname)) {
      return;
    }

    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    candidates.push(normalized);
  });

  return candidates;
}
