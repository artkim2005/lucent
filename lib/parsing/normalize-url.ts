const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAMS = new Set(["fbclid", "gclid", "ref", "cmpid", "icid"]);

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  return TRACKING_PARAMS.has(lower) || TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p));
}

/**
 * Resolves `rawUrl` against `baseUrl`, lowercases scheme+host, strips the
 * fragment and tracking params, and drops a trailing slash (except root).
 * Returns null for unparseable or non-http(s) URLs.
 */
export function normalizeUrl(rawUrl: string, baseUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl, baseUrl);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  for (const key of Array.from(url.searchParams.keys())) {
    if (isTrackingParam(key)) {
      url.searchParams.delete(key);
    }
  }

  let result = url.toString();
  if (result.endsWith("/") && url.pathname !== "/") {
    result = result.slice(0, -1);
  }

  return result;
}
