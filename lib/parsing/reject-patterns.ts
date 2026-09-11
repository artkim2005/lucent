/**
 * Non-article reject list (AGENTS.md section 9). Path segments that
 * indicate a page is never a valid article: category/section, topic/tag,
 * author, search, show/program/podcast, live, game, product/review/shop,
 * corporate/support, newsletter/subscribe.
 */
const REJECT_PATH_SEGMENTS = [
  "category",
  "categories",
  "section",
  "sections",
  "topic",
  "topics",
  "tag",
  "tags",
  "author",
  "authors",
  "search",
  "live",
  "shows",
  "show",
  "programs",
  "program",
  "podcasts",
  "podcast",
  "games",
  "game",
  "products",
  "product",
  "shop",
  "shopping",
  "reviews",
  "review",
  "newsletters",
  "newsletter",
  "subscribe",
  "subscription",
  "about",
  "contact",
  "careers",
  "privacy",
  "terms",
  "support",
  "help",
  "corporate",
  "advertise",
  "jobs",
];

const REJECT_PATH_PATTERN = new RegExp(
  `(^|/)(${REJECT_PATH_SEGMENTS.join("|")})(/|$)`,
  "i",
);

export function isRejectedPath(pathname: string): boolean {
  if (pathname === "" || pathname === "/") {
    return true;
  }
  return REJECT_PATH_PATTERN.test(pathname);
}
