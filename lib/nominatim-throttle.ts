/**
 * Outbound request throttle for Nominatim (OpenStreetMap) API.
 *
 * Nominatim enforces a strict 1 request/second policy. This module ensures
 * that all outbound Nominatim requests from this server are serialised and
 * spaced at least 1 000 ms apart, regardless of how many inbound requests
 * arrive concurrently.
 *
 * Usage:
 *   import { nominatimFetch } from "@/lib/nominatim-throttle";
 *   const response = await nominatimFetch(url, init);
 */

const MIN_INTERVAL_MS = 1_000;

let lastRequestTime = 0;
let queue: Array<{
  resolve: (value: Response) => void;
  reject: (reason: unknown) => void;
  url: string;
  init?: RequestInit;
}> = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const item = queue.shift()!;

    // Wait until at least MIN_INTERVAL_MS has passed since the last request
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise<void>((resolve) =>
        setTimeout(resolve, MIN_INTERVAL_MS - elapsed)
      );
    }

    lastRequestTime = Date.now();

    try {
      const response = await fetch(item.url, item.init);
      item.resolve(response);
    } catch (err) {
      item.reject(err);
    }
  }

  processing = false;
}

/**
 * Drop-in replacement for `fetch()` that queues outbound Nominatim requests
 * so they are spaced at least 1 second apart.
 */
export function nominatimFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    queue.push({ resolve, reject, url, init });
    void processQueue();
  });
}
