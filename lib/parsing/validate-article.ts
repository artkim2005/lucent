import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { isRejectedPath } from "@/lib/parsing/reject-patterns";
import type { ArticleValidationResult } from "@/lib/pipeline/types";

const NOISE_KEYWORDS = [
  "advertis",
  "newsletter",
  "subscri",
  "social-share",
  "share-tools",
  "related",
  "most-viewed",
  "most-popular",
  "recommend",
  "comments",
  "promo",
  "cookie",
];

const CONTAINER_SELECTORS = [
  "article",
  '[itemprop="articleBody"]',
  '[class*="article-body"]',
  '[class*="story-body"]',
  '[class*="post-content"]',
  '[class*="entry-content"]',
  "main",
  "body",
];

const BOILERPLATE_PATTERN =
  /^(sign up|subscribe|advertisement|share this|follow us|read more|load more|related:|©|copyright|reporting by|additional reporting by|our standards:)/i;

const PARAGRAPH_SELECTOR = 'p, div[data-testid^="paragraph-"]';
const MIN_PARAGRAPH_CHARS = 25;
const MEANINGFUL_PARAGRAPH_CHARS = 40;
const MIN_MEANINGFUL_PARAGRAPHS = 3;
const MIN_BODY_CHARS = 900;
const MIN_TITLE_CHARS = 10;

function stripNoise($: CheerioAPI): void {
  $("script, style, noscript, nav, footer, header, aside, iframe, form, svg, button").remove();
  $("*").each((_, el) => {
    const $el = $(el);
    const classAndId = `${$el.attr("class") ?? ""} ${$el.attr("id") ?? ""}`.toLowerCase();
    if (NOISE_KEYWORDS.some((keyword) => classAndId.includes(keyword))) {
      $el.remove();
    }
  });
}

function resolveUrl(value: string | undefined, baseUrl: string): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractTitle($: CheerioAPI): string | null {
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) {
    return ogTitle;
  }

  const titleTag = $("title").first().text().trim();
  if (titleTag) {
    const match = titleTag.match(/^(.+?)\s+[|\-–]\s+([^|\-–]{1,50})$/);
    if (match && match[1].trim().length >= MIN_TITLE_CHARS) {
      return match[1].trim();
    }
    return titleTag;
  }

  const h1 = $("h1").first().text().trim();
  return h1 || null;
}

function extractImage($: CheerioAPI, baseUrl: string): string | null {
  const og = $('meta[property="og:image"]').attr("content");
  const resolvedOg = resolveUrl(og, baseUrl);
  if (resolvedOg) {
    return resolvedOg;
  }

  const twitter = $('meta[name="twitter:image"]').attr("content");
  return resolveUrl(twitter, baseUrl);
}

function toIsoDate(value: string): string | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function findDatePublished(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const result = findDatePublished(item);
      if (result) {
        return result;
      }
    }
    return null;
  }

  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeof obj.datePublished === "string") {
      return obj.datePublished;
    }
    if (obj["@graph"]) {
      return findDatePublished(obj["@graph"]);
    }
  }

  return null;
}

function extractPublishedAt($: CheerioAPI): string | null {
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[itemprop="datePublished"]',
  ];

  for (const selector of metaSelectors) {
    const content = $(selector).attr("content");
    if (content) {
      const iso = toIsoDate(content);
      if (iso) {
        return iso;
      }
    }
  }

  const datetime = $("time[datetime]").first().attr("datetime");
  if (datetime) {
    const iso = toIsoDate(datetime);
    if (iso) {
      return iso;
    }
  }

  let found: string | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found) {
      return;
    }
    const raw = $(el).contents().text();
    try {
      const json: unknown = JSON.parse(raw);
      const date = findDatePublished(json);
      if (date) {
        const iso = toIsoDate(date);
        if (iso) {
          found = iso;
        }
      }
    } catch {
      // malformed JSON-LD, skip
    }
  });

  return found;
}

function extractParagraphs($: CheerioAPI, containerSelector: string): string[] {
  const paragraphs: string[] = [];
  $(containerSelector)
    .first()
    .find(PARAGRAPH_SELECTOR)
    .each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length < MIN_PARAGRAPH_CHARS) {
        return;
      }
      if (BOILERPLATE_PATTERN.test(text)) {
        return;
      }
      paragraphs.push(text);
    });
  return paragraphs;
}

function pickBestParagraphs($: CheerioAPI): string[] {
  let best: string[] = [];

  for (const selector of CONTAINER_SELECTORS) {
    if ($(selector).length === 0) {
      continue;
    }

    const paragraphs = extractParagraphs($, selector);
    const meaningfulCount = paragraphs.filter((p) => p.length >= MEANINGFUL_PARAGRAPH_CHARS).length;

    if (meaningfulCount >= MIN_MEANINGFUL_PARAGRAPHS) {
      return paragraphs;
    }

    const totalLen = paragraphs.reduce((sum, p) => sum + p.length, 0);
    const bestLen = best.reduce((sum, p) => sum + p.length, 0);
    if (totalLen > bestLen) {
      best = paragraphs;
    }
  }

  return best;
}

/**
 * Detail-page HTML -> cleaned article fields + accept/reject decision
 * (AGENTS.md section 13, the "article content gate").
 */
export function validateAndCleanArticle(html: string, url: string): ArticleValidationResult {
  const $ = cheerio.load(html);
  stripNoise($);

  const title = extractTitle($);
  if (!title || title.length < MIN_TITLE_CHARS) {
    return { ok: false, reason: "missing_title" };
  }

  const imageUrl = extractImage($, url);
  if (!imageUrl) {
    return { ok: false, reason: "missing_image" };
  }

  const publishedAt = extractPublishedAt($);
  if (!publishedAt) {
    return { ok: false, reason: "missing_published_date" };
  }

  const canonicalHref = $('link[rel="canonical"]').attr("href");
  const canonicalUrl = resolveUrl(canonicalHref, url);
  if (canonicalUrl) {
    try {
      if (isRejectedPath(new URL(canonicalUrl).pathname)) {
        return { ok: false, reason: "canonical_points_to_listing" };
      }
    } catch {
      // unparseable canonical, ignore
    }
  }

  const paragraphs = pickBestParagraphs($);
  const rawText = paragraphs.join("\n\n");
  const meaningfulParagraphs = paragraphs.filter((p) => p.length >= MEANINGFUL_PARAGRAPH_CHARS).length;

  if (meaningfulParagraphs < MIN_MEANINGFUL_PARAGRAPHS && rawText.length < MIN_BODY_CHARS) {
    return { ok: false, reason: "body_too_short" };
  }

  return {
    ok: true,
    article: { title, imageUrl, publishedAt, canonicalUrl, rawText },
  };
}
