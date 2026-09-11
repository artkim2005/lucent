import "server-only";

const REALTIME_ENDPOINT = "https://realtime.oxylabs.io/v1/queries";
const FETCH_TIMEOUT_MS = 90_000;

export class OxylabsFetchError extends Error {
  constructor(
    public readonly url: string,
    message: string,
  ) {
    super(`Oxylabs fetch failed for ${url}: ${message}`);
    this.name = "OxylabsFetchError";
  }
}

interface OxylabsRealtimeResponse {
  results?: Array<{
    content?: string;
    status_code?: number;
  }>;
}

function getCredentials(): { username: string; password: string } {
  const username = process.env.OXY_WSA_USERNAME;
  const password = process.env.OXY_WSA_PASSWORD;

  if (!username || !password) {
    throw new Error("Missing OXY_WSA_USERNAME or OXY_WSA_PASSWORD environment variable");
  }

  return { username, password };
}

/**
 * Fetches a URL through Oxylabs' Realtime `universal` source. Throws
 * `OxylabsFetchError` on timeout, transport failure, non-2xx HTTP, or a
 * missing/failed result -- callers treat this as a per-URL failure.
 */
export async function fetchPage(url: string): Promise<{ html: string; statusCode: number }> {
  const { username, password } = getCredentials();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(REALTIME_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      },
      body: JSON.stringify({ source: "universal", url }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new OxylabsFetchError(url, `HTTP ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as OxylabsRealtimeResponse;
    const result = body.results?.[0];

    if (!result || typeof result.content !== "string") {
      throw new OxylabsFetchError(url, "no result content in Oxylabs response");
    }

    const statusCode = result.status_code ?? 0;
    if (statusCode < 200 || statusCode >= 300) {
      throw new OxylabsFetchError(url, `target page returned status ${statusCode}`);
    }

    return { html: result.content, statusCode };
  } catch (err) {
    if (err instanceof OxylabsFetchError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new OxylabsFetchError(url, `timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw new OxylabsFetchError(url, err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timeout);
  }
}
